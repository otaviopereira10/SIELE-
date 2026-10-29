import type { Metadata } from "next";
import { DemoRunner } from "@/components/exam/demo-runner";

export const metadata: Metadata = { title: "Demostración" };

export default function DemoPage() {
  return <DemoRunner />;
}
