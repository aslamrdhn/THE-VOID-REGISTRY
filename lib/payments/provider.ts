// THE VOID REGISTRY - Payment Provider Interface & Implementation
// Source of truth: PRD §9

export interface PaymentProvider {
  createQris(o: {
    orderId: string;
    amountIdr: number;
    expiresAt: Date;
  }): Promise<{ providerRef: string; qrString: string }>;

  verifyWebhook(req: {
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<{ eventId: string; providerRef: string } | null>;

  fetchStatus(
    providerRef: string
  ): Promise<{ status: 'paid' | 'pending' | 'expired' | 'failed'; amountIdr: number }>;
}

// In-Memory / Sandbox QRIS Provider
export class SandboxQrisProvider implements PaymentProvider {
  private transactions: Map<
    string,
    { status: 'paid' | 'pending' | 'expired' | 'failed'; amountIdr: number; orderId: string }
  > = new Map();

  async createQris(o: {
    orderId: string;
    amountIdr: number;
    expiresAt: Date;
  }): Promise<{ providerRef: string; qrString: string }> {
    const providerRef = `SANDBOX_QRIS_${o.orderId.slice(0, 8)}_${Date.now()}`;
    // Standard Indonesian QRIS string dummy / sandbox string format
    const qrString = `00020101021226670014ID.LINKAJA.WWW01189360091438901234560215${o.orderId.slice(0, 15)}520458125303360540${o.amountIdr}5802ID5917THE VOID REGISTRY6007JAKARTA6304`;

    this.transactions.set(providerRef, {
      status: 'pending',
      amountIdr: o.amountIdr,
      orderId: o.orderId,
    });

    return { providerRef, qrString };
  }

  async verifyWebhook(req: {
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
  }): Promise<{ eventId: string; providerRef: string } | null> {
    try {
      const data = JSON.parse(req.rawBody);
      if (!data.provider_ref || !data.event_id) return null;
      return {
        eventId: data.event_id,
        providerRef: data.provider_ref,
      };
    } catch {
      return null;
    }
  }

  async fetchStatus(
    providerRef: string
  ): Promise<{ status: 'paid' | 'pending' | 'expired' | 'failed'; amountIdr: number }> {
    const trx = this.transactions.get(providerRef);
    if (!trx) {
      return { status: 'failed', amountIdr: 0 };
    }
    return { status: trx.status, amountIdr: trx.amountIdr };
  }

  // Simulation method for testing / sandbox demo payment
  simulatePayment(providerRef: string) {
    const trx = this.transactions.get(providerRef);
    if (trx) {
      trx.status = 'paid';
    }
  }
}

export const defaultPaymentProvider = new SandboxQrisProvider();
