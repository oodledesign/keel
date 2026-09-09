/** Shared list/paragraph classes so editor preview and public HTML match. */
export const RICH_TEXT_LIST_CLASS = [
  '[&_ul]:my-2 [&_ul]:list-outside [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-2 [&_ol]:list-outside [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5 [&_li]:list-item',
  '[&_p]:my-1',
].join(' ');
