"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleSupplierActive } from "@/app/admin/(protected)/suppliers/actions";

export function SupplierActiveToggle({ supplierId, active }: { supplierId: string; active: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const result = await toggleSupplierActive(supplierId, !active);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  };

  return (
    <Button size="sm" variant="outline" disabled={isPending} onClick={toggle}>
      {isPending ? "Updating…" : active ? "Disable supplier" : "Re-enable supplier"}
    </Button>
  );
}
