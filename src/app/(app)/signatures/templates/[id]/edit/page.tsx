import SignatureTemplateEditorPage from "@/features/signatures/components/SignatureTemplateEditorPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SignatureTemplateEditorPage id={id} />;
}
