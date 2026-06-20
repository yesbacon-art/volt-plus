import { expect, test } from "@playwright/test";

test("VOLT+ dashboard renders logo, price stream, and primary trading flows", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "伏特家" })).toBeVisible();
  await expect(page.getByAltText("VOLT+ logo")).toBeVisible();
  await expect(page.getByText("实时电价")).toBeVisible();

  await page.getByRole("button", { name: "充值" }).click();
  await expect(page.getByText("已更新")).toBeVisible();
  await expect(page.getByText(/人民币沙盒充值/)).toBeVisible();

  await page.getByRole("button", { name: "提交买电单" }).click();
  await expect(page.getByText("我的订单")).toBeVisible();
  await expect(page.getByText(/POWER_BUY|冻结买电资金|买入/)).toBeVisible();

  await page.getByRole("button", { name: "购买 Token" }).click();
  await expect(page.getByText(/最近状态：/)).toBeVisible();

  await page.getByRole("button", { name: "创建交割指令" }).click();
  await expect(page.getByText("ACCEPTED")).toBeVisible();
});
