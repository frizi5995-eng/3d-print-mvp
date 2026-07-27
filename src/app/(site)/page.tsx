import { Container } from "@/components/layout/container";

export default function HomePage() {
  return (
    <Container className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Turn your 3D model into a real product
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Upload your model, choose how you want it made, and get a manufacturing quote.
      </p>
    </Container>
  );
}
