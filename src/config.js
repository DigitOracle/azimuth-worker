// OFF-PLAN BUYING CONFIG (v375, 7 Oct 2026). One place for the switches a person decides.
//
// The Dubai Land Department registration fee of 4% is policy, not data: nothing in our registers states it, and a person has not yet
// confirmed where the figure is published. So the cash card keeps it as a SEPARATE line behind a flag, OFF by default. While the flag is
// off the line is not printed at all, and neither is anything about fees other than "excludes fees".
//
// To turn it on: a person writes the source below (the published fee schedule and the date it was read), then sets the flag to true.
// With the flag on and the source still empty, the line says "source to be confirmed" and carries the label UNVERIFIED.
export const OFFPLAN_CONFIG = {
  SHOW_REGISTRATION_FEE: false,
  REGISTRATION_FEE_PCT: 4,
  REGISTRATION_FEE_SOURCE: "",   // TO BE CONFIRMED BY A PERSON: where the 4% is published, and the date it was read
};
