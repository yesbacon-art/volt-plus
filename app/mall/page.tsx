import { getCurrentAccount, publicAccount } from "@/lib/auth";
import { listMallProducts } from "@/lib/mall";
import { MallClient } from "@/components/mall-client";

export const dynamic = "force-dynamic";

export default async function MallPage() {
  const [products, account] = await Promise.all([listMallProducts(), getCurrentAccount()]);

  return (
    <MallClient
      initialProducts={products.map((product) => ({
        id: product.id,
        slug: product.slug,
        name: product.name,
        category: product.category,
        description: product.description,
        priceVcoin: Number(product.priceVcoin),
        stock: product.stock,
        specs: Array.isArray(product.specs) ? product.specs.map(String) : []
      }))}
      initialSession={
        account
          ? {
              account: publicAccount(account),
              wallet: account.wallet
                ? {
                    vcoinAvailable: Number(account.wallet.vcoinAvailable),
                    vcoinReserved: Number(account.wallet.vcoinReserved),
                    tokenBalance: Number(account.wallet.tokenBalance)
                  }
                : null
            }
          : { account: null, wallet: null }
      }
    />
  );
}
