import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { isAuthFailure, verifyTaskAuth, type TaskAuth } from '@/lib/taskSecurity';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const auth = body.auth as TaskAuth | undefined;
  const verified = await verifyTaskAuth(auth, 'POST', '/api/tasks/my-submissions', body);
  if (isAuthFailure(verified)) return verified;

  const supabase = createServerSupabaseClient();
  const wallet = verified.address.toLowerCase();
  const [{ data: submissions, error }, { data: createdTasks, error: tasksError }] = await Promise.all([
    supabase
    .from('tipjar_task_submissions')
    .select('id,task_id,status,review_note,review_tx_hash,created_at')
    .eq('worker_address', wallet)
    .order('updated_at', { ascending: false })
    .limit(100),
    supabase
      .from('tipjar_tasks')
      .select('id,escrow_task_id,creator_address,title,description,requirements,reward_per_completion,slots,status,created_at,duration_days,expires_at')
      .eq('creator_address', wallet)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  if (error) {
    console.error('Task submission history load failed:', error);
    return NextResponse.json({ error: 'Could not load your submission status.' }, { status: 503 });
  }
  if (tasksError) {
    console.error('Created task history load failed:', tasksError);
    return NextResponse.json({ error: 'Could not load your created tasks.' }, { status: 503 });
  }

  const results = [];
  for (const submission of submissions || []) {
    const { data: task, error: taskError } = await supabase
      .from('tipjar_tasks')
      .select('id,title,reward_per_completion,status,expires_at')
      .eq('id', submission.task_id)
      .single();
    if (taskError || !task) continue;
    results.push({ ...submission, task });
  }

  const taskIds = (createdTasks || []).map((task) => task.id);
  const { data: reservations, error: reservationsError } = taskIds.length
    ? await supabase
      .from('tipjar_task_submissions')
      .select('task_id')
      .in('task_id', taskIds)
      .in('status', ['pending', 'approved'])
    : { data: [], error: null };
  if (reservationsError) {
    console.error('Created task progress lookup failed:', reservationsError);
    return NextResponse.json({ error: 'Could not load created task progress.' }, { status: 503 });
  }

  const claimedByTask = new Map<string, number>();
  for (const reservation of reservations || []) {
    claimedByTask.set(reservation.task_id, (claimedByTask.get(reservation.task_id) || 0) + 1);
  }
  const taskResults = (createdTasks || []).map((task) => ({
    ...task,
    total_slots: task.slots,
    claimed_slots: claimedByTask.get(task.id) || 0,
  }));
  return NextResponse.json({ submissions: results, createdTasks: taskResults });
}
