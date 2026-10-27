// Old click path, kept so links in emails sent before the signature links moved still track
// and redirect. signoff.growthpad.co.ke forwards /api/templates/... here unchanged.
export { GET } from "@/app/api/signatures/templates/[id]/click/route";
