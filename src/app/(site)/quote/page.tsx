import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ModelViewer } from "@/components/model-viewer/model-viewer";
import { QuoteForm } from "@/components/quote/quote-form";
import { ProgressSteps } from "@/components/quote/progress-steps";
import { Button } from "@/components/ui/button";
import { createServiceClient } from "@/lib/supabase/server";
import { MODEL_STORAGE_BUCKET } from "@/lib/models";
import type { ModelFileType } from "@/types";

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ model?: string }>;
}) {
  const { model: modelId } = await searchParams;
  if (!modelId) return <EmptyState />;

  const supabase = createServiceClient();
  const { data: model } = await supabase
    .from("models")
    .select("id, filename, storage_path, file_type, file_size")
    .eq("id", modelId)
    .maybeSingle();

  if (!model) return <EmptyState />;

  const { data: signed } = await supabase.storage
    .from(MODEL_STORAGE_BUCKET)
    .createSignedUrl(model.storage_path, 3600);

  return (
    <Container className="py-8 sm:py-10">
      <ProgressSteps current={2} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[11fr_9fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <div className="aspect-square w-full lg:aspect-4/3">
            {signed?.signedUrl ? (
              <ModelViewer
                url={signed.signedUrl}
                fileType={model.file_type as ModelFileType}
                filename={model.filename}
                fileSize={model.file_size}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-secondary/40 text-sm text-muted-foreground">
                Preview unavailable
              </div>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">How should we make it?</h1>
          <p className="mt-1 text-muted-foreground">
            Tell us how you&apos;d like this made. We&apos;ll review your model and send a quote.
          </p>
          <QuoteForm modelId={model.id} />
        </div>
      </div>
    </Container>
  );
}

function EmptyState() {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Upload a model to get started</h1>
      <p className="max-w-md text-muted-foreground">
        We couldn&apos;t find a model for this request. Upload one from the homepage to configure
        a quote.
      </p>
      <Button nativeButton={false} render={<Link href="/#upload" />}>
        Upload a model
      </Button>
    </Container>
  );
}
