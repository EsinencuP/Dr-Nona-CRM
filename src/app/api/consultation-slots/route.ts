import { createConsultationSlotsHandler } from "../../../../server/api/consultation-slots-handler";

const handler = createConsultationSlotsHandler();

export async function GET(request: Request) {
  return handler(request);
}
