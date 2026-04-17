import { useCallback, useState } from "react";
import api from "@/lib/api";

interface CreatedCustomer {
  email: string | null;
  id: string;
  name: string;
  phone: string;
}

interface CreateCustomerInput {
  email?: string;
  name: string;
  phone: string;
}

export function useCreateCustomer() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (input: CreateCustomerInput): Promise<CreatedCustomer> => {
      setIsCreating(true);
      setError(null);
      try {
        const res = await api.post("/customers", input);
        return res.data as CreatedCustomer;
      } catch (err: unknown) {
        let message = "Failed to create customer";
        if (err && typeof err === "object" && "response" in err) {
          const resp = (err as { response?: { data?: { message?: string } } })
            .response;
          if (resp?.data?.message) {
            message = resp.data.message;
          }
        }
        setError(message);
        throw new Error(message);
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return { clearError, create, error, isCreating };
}
