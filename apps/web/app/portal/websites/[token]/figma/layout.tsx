/**
 * Strip portal padding/chrome for Figma import URLs.
 * Parent portal layout still supplies document shell + CSS variables.
 */
export default function FigmaWireframeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-svh bg-[#f7f6f3]">{children}</div>;
}
