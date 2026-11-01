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
  const verified = await verifyTaskAuth(auth, 'POST', '/api/tasks/review-queue', body, true);
  if (isAuthFailure(verified)) return verified;

  const supabase = createServerSupabaseClient();
  const { data: submissions, error } = await supabase
    .from('tipjar_task_submissions')
    .select('id,task_id,worker_address,proof_text,proof_url,proof_storage_path,status,created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) {
    console.error('Task review queue load failed:', error);
    return NextResponse.json({ error: 'Could not load the review queue.' }, { status: 503 });
  }

  const result = [];
  for (const submission of submissions || []) {
    const [{ data: task, error: taskError }, proof] = await Promise.all([
      supabase.from('tipjar_tasks').select('id,escrow_task_id,title,requirements,reward_per_completion,slots,creator_address').eq('id', submission.task_id).single(),
      submission.proof_storage_path
        ? supabase.storage.from('tipjar-task-proofs').createSignedUrl(submission.proof_storage_path, 15 * 60)
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (taskError || !task) {
      console.error('Task review queue contains a missing task:', taskError);
      continue;
    }
    if (proof.error) {
      console.error('Task proof signed URL creation failed:', proof.error);
      return NextResponse.json({ error: 'Could not load proof screenshots.' }, { status: 503 });
    }
    result.push({
      ...submission,
      task,
      proof_image_url: proof.data?.signedUrl ?? '',
    });
  }
  return NextResponse.json(result);
}
