import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSupplierById } from "@/lib/admin/suppliers";
import { SupplierForm } from "@/components/admin/supplier-form";
import { SupplierActiveToggle } from "@/components/admin/supplier-active-toggle";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplier = await getSupplierById(id);
  if (!supplier) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6 p-6">
      <Link
        href="/admin/suppliers"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to suppliers
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{supplier.name}</h1>
        <SupplierActiveToggle supplierId={supplier.id} active={supplier.active} />
      </div>
      <SupplierForm supplier={supplier} />
    </div>
  );
}
