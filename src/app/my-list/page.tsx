import { Suspense } from "react";
import MyListClient from "./MyListClient";

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gls-black" />}>
      <MyListClient />
    </Suspense>
  );
}
