import { describe, expect, it } from "vitest";
import {
  personalDetailsSchema, missingPersonalDetails, REQUIRED_PERSONAL_DETAILS,
} from "@/lib/validation/registration";
import { profileUpdateSchema } from "@/lib/validation/profile";
import { needsPersonalDetails, STATUS_COPY, PROFILE_UNDER_VERIFICATION } from "@/lib/auth/routing";

/**
 * Mandatory personal details (Website Improvements §3). One schema serves the
 * form and the API, and one function decides completeness for the gate — so
 * these tests are what keep the three in agreement.
 */
const complete = {
  dob: "1995-04-02", heightCm: 170, maritalStatus: "NEVER_MARRIED", gotra: "Garg",
  highestQualification: "B.Com", occupation: "Chartered Accountant",
  address: { city: "Hyderabad", state: "Telangana", pincode: "500001" },
  family: { fatherName: "Ramesh", motherName: "Sunita" },
};

describe("personalDetailsSchema", () => {
  it("accepts the mandatory set with everything else left out", () => {
    expect(personalDetailsSchema.safeParse(complete).success).toBe(true);
  });

  it("rejects an empty form with a clear message for every required field", () => {
    const result = personalDetailsSchema.safeParse({});
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    for (const key of ["dob", "heightCm", "maritalStatus", "gotra", "highestQualification", "occupation", "address", "family"]) {
      expect(paths, key).toContain(key);
    }
    for (const issue of result.error!.issues) expect(issue.message).not.toMatch(/invalid input|expected/i);
  });

  it("rejects blank or whitespace-only required text", () => {
    const result = personalDetailsSchema.safeParse({
      ...complete, gotra: "   ", address: { city: "", state: "Telangana", pincode: "500001" },
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["gotra", "address.city"]));
  });

  it("still validates formats: PIN code, height range and the 18+ date of birth", () => {
    expect(personalDetailsSchema.safeParse({ ...complete, address: { ...complete.address, pincode: "12" } }).success).toBe(false);
    expect(personalDetailsSchema.safeParse({ ...complete, heightCm: 90 }).success).toBe(false);
    expect(personalDetailsSchema.safeParse({ ...complete, dob: "2015-01-01" }).success).toBe(false);
  });

  it("keeps the optional fields optional", () => {
    const result = personalDetailsSchema.safeParse({
      ...complete, subcaste: undefined, annualIncomeInr: undefined, partnerPreferences: undefined,
    });
    expect(result.success).toBe(true);
  });
});

describe("missingPersonalDetails", () => {
  it("is empty for a complete set", () => {
    expect(missingPersonalDetails({
      dob: "1995-04-02", heightCm: 170, maritalStatus: "NEVER_MARRIED", gotra: "Garg",
      highestQualification: "B.Com", occupation: "CA", city: "Hyderabad", state: "Telangana",
      pincode: "500001", fatherName: "Ramesh", motherName: "Sunita",
    })).toEqual([]);
  });

  it("lists every required detail that is null, undefined or blank", () => {
    expect(missingPersonalDetails({})).toEqual(REQUIRED_PERSONAL_DETAILS.map((d) => d.key));
    expect(missingPersonalDetails({ gotra: "  ", city: null })).toEqual(
      expect.arrayContaining(["gotra", "city"]));
  });

  it("covers exactly the fields the schema requires", () => {
    const required = personalDetailsSchema.safeParse({}).error!.issues.map((i) => i.path[0]);
    // address and family stand for their own required sub-fields.
    expect(new Set(required)).toEqual(new Set([
      "dob", "heightCm", "maritalStatus", "gotra", "highestQualification", "occupation", "address", "family",
    ]));
    expect(REQUIRED_PERSONAL_DETAILS.map((d) => d.key)).toEqual([
      "dob", "heightCm", "maritalStatus", "gotra", "highestQualification", "occupation",
      "city", "state", "pincode", "fatherName", "motherName",
    ]);
  });
});

describe("profileUpdateSchema — mandatory details can change but not be blanked", () => {
  it("allows a partial edit that does not touch them", () => {
    expect(profileUpdateSchema.safeParse({ subcaste: "Agarwal" }).success).toBe(true);
  });

  it("refuses to blank a required detail", () => {
    expect(profileUpdateSchema.safeParse({ gotra: "" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ address: { line1: "1 Road" } }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ family: { native: "Jaipur" } }).success).toBe(false);
  });

  it("allows changing a required detail to another value", () => {
    expect(profileUpdateSchema.safeParse({
      gotra: "Mittal", address: { city: "Pune", state: "Maharashtra", pincode: "411001" },
    }).success).toBe(true);
  });
});

describe("needsPersonalDetails — the post-payment gate", () => {
  const base = { personalDetailsComplete: false, paymentStatus: "SUCCESS" as const };

  it("applies once paid, whether awaiting verification or already verified", () => {
    for (const status of ["PAYMENT_SUCCESS", "PENDING_VERIFICATION", "VERIFIED"] as const) {
      expect(needsPersonalDetails({ ...base, registrationStatus: status }), status).toBe(true);
    }
  });

  it("never applies before payment, so nobody is asked to pay again", () => {
    for (const status of ["DRAFT", "SUBMITTED", "PAYMENT_PENDING", "PAYMENT_FAILED"] as const) {
      expect(needsPersonalDetails({ ...base, paymentStatus: "PENDING", registrationStatus: status }), status).toBe(false);
    }
  });

  it("does not apply to rejected, suspended or deleted accounts", () => {
    for (const status of ["REJECTED", "SUSPENDED", "DELETED"] as const) {
      expect(needsPersonalDetails({ ...base, registrationStatus: status }), status).toBe(false);
    }
  });

  it("does not apply once the details are complete", () => {
    expect(needsPersonalDetails({ ...base, personalDetailsComplete: true, registrationStatus: "VERIFIED" })).toBe(false);
  });
});

describe("verification-pending message (Website Improvements §4)", () => {
  it("is shown, word for word, for both paid-but-unverified states", () => {
    for (const status of ["PAYMENT_SUCCESS", "PENDING_VERIFICATION"] as const) {
      expect(STATUS_COPY[status].title).toBe("Profile Under Verification");
      expect(STATUS_COPY[status].body).toBe(
        "Your profile is currently under verification by our admin team. " +
        "You will be able to access your account once your profile has been verified.");
    }
    expect(PROFILE_UNDER_VERIFICATION.help).toBe("For further information or assistance, please contact us.");
  });
});
