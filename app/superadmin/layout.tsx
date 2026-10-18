import { Topplinje } from "@/components/Topplinje";

export const metadata = { title: "Superadmin – Petanque Seriespill" };

export default function SuperadminLayout({ children }: LayoutProps<"/superadmin">) {
  return (
    <>
      <Topplinje tittel="Superadmin" hjemUrl="/superadmin" />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">{children}</main>
    </>
  );
}
