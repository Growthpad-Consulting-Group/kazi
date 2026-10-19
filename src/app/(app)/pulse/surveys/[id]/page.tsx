import SurveyDetailPage from "@/features/pulse/surveys/components/SurveyDetailPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SurveyDetailPage surveyId={id} />;
}
