import type { Metadata } from "next";
import { ProjectReviewForm } from "./ProjectReviewForm";

export const metadata: Metadata = {
  title: "Opinia o współpracy",
  robots: { index: false, follow: false },
};

/** Publiczny (bez logowania) formularz opinii o zakończonym projekcie — link
 * wysyłany mailem (patrz app/api/projects/[id]/request-review). Token pełni
 * rolę hasła-w-linku; brak isAuthed() jest tu celowy. Wzorem
 * app/[lang]/oferta/[token]. */
export default async function PublicProjectReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ProjectReviewForm token={token} />;
}
