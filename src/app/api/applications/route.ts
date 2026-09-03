import { createApplicationsHandler } from "../../../../api/applications";

const handleApplication = createApplicationsHandler();

export async function POST(request: Request) {
  return handleApplication(request);
}
