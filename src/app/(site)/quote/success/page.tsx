import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createServiceClient } from "@/lib/supabase/server";

export default async function QuoteSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const referenceNumber = ref ? Number(ref) : NaN;

  let summary: {
    filename: string;
    quantity: number;
    material: string;
    color: string;
    country: string;
  } | null = null;

  if (Number.isInteger(referenceNumber)) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("manufacturing_requests")
      .select("quantity, material, color, country, models(filename)")
      .eq("reference_number", referenceNumber)
      .maybeSingle();

    if (data) {
      const model = Array.isArray(data.models) ? data.models[0] : data.models;
      summary = {
        filename: model?.filename ?? "your model",
        quantity: data.quantity,
        material: data.material,
        color: data.color,
        country: data.country,
      };
    }
  }

  return (
    <Container className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
      <div className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <CheckCircle2 className="size-7" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">We received your model</h1>
        <p className="max-w-md text-muted-foreground">
          We&apos;ll review your model and prepare a manufacturing quote. We&apos;ll reach out by
          email once it&apos;s ready.
        </p>
      </div>

      {Number.isInteger(referenceNumber) && (
        <p className="text-sm font-medium text-muted-foreground">
          Request #{referenceNumber}
        </p>
      )}

      {summary && (
        <Card className="w-full max-w-sm text-left">
          <CardContent className="flex flex-col gap-2 text-sm">
            <SummaryRow label="Model" value={summary.filename} />
            <SummaryRow label="Quantity" value={String(summary.quantity)} />
            <SummaryRow label="Material" value={summary.material} />
            <SummaryRow label="Color" value={summary.color} />
            <SummaryRow label="Location" value={summary.country} />
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        You will receive an email once the quote is ready.
      </p>

      <Button nativeButton={false} render={<Link href="/" />} variant="outline">
        Back to home
      </Button>
    </Container>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}
