import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { findTaskEvent, getTaskReceipt } from '@/lib/taskChain';
import { isAuthFailure, verifyTaskAuth, type TaskAuth } from '@/lib/taskSecurity';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const auth = body.auth as TaskAuth | undefined;
  const verified = await verifyTaskAuth(auth, 'POST', '/api/tasks/submissions', body);
  if (isAuthFailure(verified)) return verified;

  const { taskId, proofText, proofUrl, proofStoragePath, reservationTxHash } = body;
  if (
    typeof taskId !== 'string' || !UUID.test(taskId) ||
    typeof proofText !== 'string' || proofText.length > 2000 ||
    typeof proofUrl !== 'string' || proofUrl.length > 2048 ||
    typeof proofStoragePath !== 'string' || proofStoragePath.length > 300 ||
    (!proofText.trim() && !proofUrl.trim() && !proofStoragePath)
  ) {
    return NextResponse.json({ error: 'Provide proof text, a link, or a screenshot.' }, { status: 400 });
  }
  if (typeof reservationTxHash !== 'string') {
    return NextResponse.json({ error: 'A task reservation transaction is required.' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: task, error: taskError } = await supabase
    .from('tipjar_tasks')
    .select('id,escrow_task_id,creator_address,status,expires_at')
    .eq('id', taskId)
    .single();
  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  }
  if (task.status !== 'open') {
    return NextResponse.json({ error: 'This task is no longer accepting submissions.' }, { status: 409 });
  }
  if (task.expires_at && new Date(task.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This task has expired and is no longer accepting submissions.' }, { status: 409 });
  }
  if (task.creator_address.toLowerCase() === verified.address.toLowerCase()) {
    return NextResponse.json({ error: 'Task creators cannot submit to their own tasks.' }, { status: 403 });
  }
  if (proofStoragePath && !proofStoragePath.startsWith(`${task.id}/${verified.address.toLowerCase()}/`)) {
    return NextResponse.json({ error: 'Screenshot path does not belong to this wallet and task.' }, { status: 403 });
  }
  if (proofUrl) {
    try {
      const url = new URL(proofUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported URL scheme.');
    } catch {
      return NextResponse.json({ error: 'Proof links must use http or https.' }, { status: 400 });
    }
  }

  const receipt = await getTaskReceipt(reservationTxHash, verified.address);
  if (receipt instanceof NextResponse) return receipt;
  const event = findTaskEvent(receipt.logs, 'SubmissionReserved');
  if (
    !event || event.eventName !== 'SubmissionReserved' ||
    event.args.taskId.toLowerCase() !== task.escrow_task_id.toLowerCase() ||
    event.args.worker.toLowerCase() !== verified.address.toLowerCase()
  ) {
    return NextResponse.json({ error: 'Reservation transaction does not match this task and wallet.' }, { status: 400 });
  }

  const submission = {
    task_id: task.id,
    worker_address: verified.address.toLowerCase(),
    proof_text: proofText.trim(),
    proof_url: proofUrl.trim(),
    proof_storage_path: proofStoragePath,
    reservation_tx_hash: reservationTxHash.toLowerCase(),
    status: 'pending',
    review_note: '',
    review_tx_hash: null,
    updated_at: new Date().toISOString(),
  };
  const { data: resubmitted, error: updateError } = await supabase
    .from('tipjar_task_submissions')
    .update(submission)
    .eq('task_id', task.id)
    .eq('worker_address', verified.address.toLowerCase())
    .eq('status', 'rejected')
    .select()
    .maybeSingle();

  if (updateError) {
    console.error('Task resubmission failed:', updateError);
    return NextResponse.json({ error: 'Could not save your proof.' }, { status: 503 });
  }
  if (resubmitted) return NextResponse.json(resubmitted, { status: 200 });

  const { data, error } = await supabase.from('tipjar_task_submissions').insert(submission).select().single();
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A submission for this task is already awaiting review or has been paid.' }, { status: 409 });
    }
    console.error('Task submission failed:', error);
    return NextResponse.json({ error: 'Could not save your proof.' }, { status: 503 });
  }
  return NextResponse.json(data, { status: 201 });
}
