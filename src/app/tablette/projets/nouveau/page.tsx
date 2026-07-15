import { redirect } from "next/navigation";

/** Ancienne URL : la création se fait via le bouton sur la liste des projets. */
export default function NouveauProjetPage() {
  redirect("/tablette");
}
