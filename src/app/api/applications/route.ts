import { createApplicationsHandler } from "../../../../server/api/applications-handler";

const handleApplication = createApplicationsHandler();

export async function POST(request: Request) {
  return handleApplication(request);
}
