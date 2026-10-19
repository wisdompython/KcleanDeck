import { expect, test } from "@playwright/test";

import { openBookingStep, OWNER, signIn, unique } from "./helpers";

test.describe("Team accounts and roles", () => {
  test("an owner adds a staff member who can book but not change prices", async ({ browser }) => {
    const owner = await browser.newPage({ storageState: OWNER.storageState });
    const name = unique("Staff Member");
    const email = `${name.split(" ").pop()}@staff.e2e.kleandeck.test`;

    await owner.goto("/admin/team");
    await owner.getByRole("button", { name: "Add team member" }).click();
    const add = owner.getByRole("dialog");
    await add.getByLabel("Name").fill(name);
    await add.getByLabel("Email").fill(email);
    await add.getByRole("button", { name: "Add", exact: true }).click();

    const reveal = owner.getByRole("dialog", { name: "Share these sign-in details" });
    await expect(reveal).toContainText(`Email: ${email}`);
    const password = (await reveal.getByText(/^Password: /).textContent())!.replace("Password: ", "").trim();
    await reveal.getByRole("button", { name: "Done" }).click();
    await expect(owner.getByText(email)).toBeVisible();

    // The new staff member signs in on their own device.
    const staffContext = await browser.newContext();
    const staff = await staffContext.newPage();
    await signIn(staff, email, password);
    const nav = staff.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Bookings" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Team" })).toHaveCount(0);

    // Read-only pricing and settings.
    await staff.goto("/admin/services");
    await expect(staff.getByText("Only owners can change services and rates.")).toBeVisible();
    await expect(staff.getByRole("link", { name: "New service" })).toHaveCount(0);
    await staff.getByRole("link", { name: /Standard cleaning/ }).click();
    await staff.getByRole("tab", { name: /Pricing/ }).click();
    await expect(staff.getByLabel("Starting price", { exact: true })).toBeDisabled();
    await expect(staff.getByRole("button", { name: "Save service" })).toHaveCount(0);
    await staff.goto("/admin/settings");
    await expect(staff.getByLabel("WhatsApp number")).toBeDisabled();
    await staff.goto("/admin/team");
    await expect(staff.getByText("Owners only")).toBeVisible();

    // But they can enter a booking.
    await staff.goto("/admin/bookings/new");
    await staff.getByLabel("Contact name").fill(unique("Staff Booking"));
    await staff.getByLabel("Phone (WhatsApp)").fill("08012121212");
    await staff.getByRole("button", { name: "Continue", exact: true }).click();
    await staff.getByRole("button", { name: /Facility support/ }).click();
    await openBookingStep(staff, "Review & billing");
    await staff.getByLabel("Agreed price before VAT (₦)").fill("25000");
    await staff.getByRole("button", { name: "Create booking" }).click();
    await expect(staff.getByText(new RegExp(`created .* by ${name}`))).toBeVisible();

    // The owner deactivates them; their session stops working.
    const row = owner.locator("div", { hasText: email }).filter({ has: owner.getByRole("button", { name: "Deactivate" }) }).last();
    await row.getByRole("button", { name: "Deactivate" }).click();
    await expect(owner.getByText("Team updated")).toBeVisible();
    await staff.goto("/admin");
    await expect(staff).toHaveURL(/\/admin\/login/);

    await staffContext.close();
    await owner.close();
  });

  test("owners can't lock themselves out", async ({ browser }) => {
    const owner = await browser.newPage({ storageState: OWNER.storageState });
    await owner.goto("/admin/team");
    const self = owner.locator("div", { hasText: "You" }).filter({ has: owner.getByRole("combobox", { name: "Role" }) }).last();
    await expect(self.getByRole("combobox", { name: "Role" })).toBeDisabled();
    await expect(self.getByRole("button", { name: "Deactivate" })).toHaveCount(0);
    await owner.close();
  });
});
