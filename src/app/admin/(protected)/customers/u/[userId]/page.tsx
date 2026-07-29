import { notFound } from "next/navigation";
import { getCustomerAccountInfo, getCustomerRequests } from "@/lib/admin/customers";
import { CustomerDetailView } from "@/components/admin/customer-detail-view";

export default async function RegisteredCustomerPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [account, requests] = await Promise.all([
    getCustomerAccountInfo(userId),
    getCustomerRequests(userId, ""),
  ]);

  if (!account && requests.length === 0) notFound();

  const name = requests[0]?.customer_name ?? account?.email ?? "Registered customer";

  return (
    <CustomerDetailView
      name={name}
      email={account?.email ?? requests[0]?.customer_email ?? ""}
      isRegistered
      account={account}
      requests={requests}
    />
  );
}
