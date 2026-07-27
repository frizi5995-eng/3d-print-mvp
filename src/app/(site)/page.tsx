import { UploadCloud, FileCheck2, PackageCheck } from "lucide-react";
import { Container } from "@/components/layout/container";
import { ModelDropzone } from "@/components/upload/model-dropzone";

const STEPS = [
  {
    number: "01",
    icon: UploadCloud,
    title: "Upload",
    description: "Send us your model.",
  },
  {
    number: "02",
    icon: FileCheck2,
    title: "Get a quote",
    description: "We review your model and calculate the manufacturing price.",
  },
  {
    number: "03",
    icon: PackageCheck,
    title: "We make it",
    description: "A manufacturing partner produces and ships your item.",
  },
];

const FAQS = [
  {
    question: "What file formats can I upload?",
    answer:
      "STL, 3MF, and OBJ. If you're not sure your file will work, upload it anyway — we'll tell you if there's a problem.",
  },
  {
    question: "Do I need to know anything about 3D printing?",
    answer:
      "No. You don't need to worry about slicing, infill, supports, or wall thickness — we handle all of that when we prepare your quote.",
  },
  {
    question: "How much does it cost?",
    answer:
      "It depends on your model's size, material, and quantity. We'll review your upload and send you a fixed price before you commit to anything.",
  },
  {
    question: "Do I have to pay when I request a quote?",
    answer: "No. Requesting a quote is free. You only decide whether to proceed once you've seen the price.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="py-16 sm:py-24">
        <Container className="flex flex-col gap-10">
          <div className="flex max-w-2xl flex-col gap-4">
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
              Turn your 3D model
              <br />
              into <span className="text-primary">a real product</span>
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Upload your model, choose how you want it made, and get a manufacturing quote.
            </p>
          </div>

          <div className="w-full max-w-3xl">
            <ModelDropzone />
            <p className="mt-4 text-sm text-muted-foreground">
              No 3D printer required. We handle manufacturing and delivery.
            </p>
          </div>
        </Container>
      </section>

      <section id="how-it-works" className="border-t border-border py-16 sm:py-24">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
            {STEPS.map((step) => (
              <div key={step.number} className="flex flex-col gap-3 sm:px-8 sm:first:pl-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted-foreground">{step.number}</span>
                  <step.icon className="size-5 text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="materials" className="border-t border-border py-16 sm:py-24">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Materials</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            We&apos;re starting with one reliable, affordable material. More options are coming as
            we grow.
          </p>
          <div className="mt-8 flex items-center justify-between gap-6 rounded-2xl border border-border bg-card px-6 py-5">
            <div>
              <h3 className="font-medium">PLA</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A durable, easy-to-print plastic suited for most everyday parts, prototypes, and
                décor.
              </p>
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <span className="size-4 rounded-full border border-border-strong bg-white" />
              <span className="size-4 rounded-full border border-border-strong bg-black" />
              <span className="text-xs text-muted-foreground">+ custom colors</span>
            </div>
          </div>
        </Container>
      </section>

      <section id="faq" className="border-t border-border py-16 sm:py-24">
        <Container>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">FAQ</h2>
          <div className="mt-10 flex max-w-2xl flex-col divide-y divide-border">
            {FAQS.map((faq) => (
              <div key={faq.question} className="py-5 first:pt-0">
                <h3 className="font-medium">{faq.question}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
