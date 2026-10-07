// tasks: [{ status }] -> integer percent of tasks done
export function progress(tasks) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100);
}
