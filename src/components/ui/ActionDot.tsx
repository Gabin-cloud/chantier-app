/** Pastille bleue : une action est attendue de notre part. */
export function ActionDot({ title }: { title: string }) {
  return (
    <span
      title={title}
      className="ml-1 inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500 align-middle ring-2 ring-blue-100"
    />
  );
}
