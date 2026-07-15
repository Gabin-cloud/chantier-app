import { redirect } from "next/navigation";

/** Ancienne URL : la création se fait via le bouton « + Nouveau » sur la liste. */
export default function NouveauProjetPcPage() {
  redirect("/pc");
}
