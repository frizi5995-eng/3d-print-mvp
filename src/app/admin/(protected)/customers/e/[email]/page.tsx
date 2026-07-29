import { notFound } from "next/navigation";
import { getCustomerRequests } from "@/lib/admin/customers";
import { CustomerDetailView } from "@/components/admin/customer-detail-view";

export default async function GuestCustomerPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const decodedEmail = decodeURIComponent(email);
  const requests = await getCustomerRequests(null, decodedEmail);

  if (requests.length === 0) notFound();

  const name = requests[0]?.customer_name ?? decodedEmail;

  return (
    <CustomerDetailView
      name={name}
      email={decodedEmail}
      isRegistered={false}
      account={null}
      requests={requests}
    />
  );
}
