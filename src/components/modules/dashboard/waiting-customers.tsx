import { useTranslation } from "react-i18next";

interface WaitingCustomer {
  id: string;
  initials: string;
  name: string;
  waitMinutes: number;
}

interface WaitingCustomersProps {
  customers: WaitingCustomer[];
}

export default function WaitingCustomers({ customers }: WaitingCustomersProps) {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="mb-4 font-bold font-headline text-lg">
        {t("front_desk.waiting_in_shop")}
      </h2>
      {customers.length === 0 ? (
        <p className="font-medium text-on-surface-variant text-sm">
          {t("front_desk.no_waiting_customers")}
        </p>
      ) : (
        <div className="space-y-2">
          {customers.map((customer) => (
            <div
              className="flex items-center justify-between rounded-lg bg-surface-container-low p-3"
              key={customer.id}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container font-bold text-[10px] text-primary">
                  {customer.initials}
                </div>
                <p className="font-medium text-sm">{customer.name}</p>
              </div>
              <span className="font-bold text-[10px] text-on-surface-variant">
                {t("front_desk.minutes_abbreviated", {
                  minutes: customer.waitMinutes,
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
