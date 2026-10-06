// Momo's quote bank: one line under every 9 PM verdict and 5 AM opener. Local, curated, no web lookups.
// Attribution is kept honest: a line with an author is a short, long-public-domain saying and says whose it is traditionally held to be
// ("attributed to" where the attribution is traditional rather than verified); every other line is ORIGINAL to Momo and carries no name.
// Tiers: missed (nothing done / floor missed), partial (floor met but a rule broken), hit (a clean day), streak (a clean day on a run of 3+).
// Each tier holds 16 lines, 64 in all. Two messages a day for 30 days is 60 draws, so the rotation in fitQuote() can honour "never the
// same line within 30 days" even when a person lives in one tier (it widens to the other tiers before it ever repeats).
const O = (t) => [t, ""];
export const FIT_QUOTES = {
  missed: [
    O("A day you skipped is not a setback. It is a vote for the person you do not want to be."),
    O("The plan did not fail you today. You skipped the plan."),
    O("Motivation is not coming to rescue you. Start small and start now."),
    O("Excuses are comfortable. So is doing nothing, until it is not."),
    O("You do not need a better plan. You need the next ten minutes."),
    O("Yesterday is a receipt. Read it, then spend today differently."),
    O("The floor is thirty minutes. Even the floor was optional today. It is not tomorrow."),
    O("Nobody is coming to do your reps. Nobody can."),
    O("You are one decision away from a different day. Make it early."),
    O("Skipping once is a day. Skipping twice is a habit forming."),
    O("Do not negotiate with the alarm. Negotiate with the excuse."),
    O("Regret is cheap before bed and expensive in a month. Move first."),
    ["The journey of a thousand miles begins with a single step.", "Lao Tzu, Tao Te Ching"],
    ["What stands in the way becomes the way.", "Marcus Aurelius, Meditations (traditional paraphrase)"],
    ["No man is free who is not master of himself.", "attributed to Epictetus"],
    O("Standards are what you do when no one is checking. Tonight, nobody is checking but you.")
  ],
  partial: [
    O("Half a win is still half a miss. Close the other half."),
    O("The movement happened. The discipline around it did not. Fix the part you skipped."),
    O("Good is the enemy of clean. Tomorrow, make it clean."),
    O("You did the hard part and bent the easy part. Hold both."),
    O("Rules you keep only when it suits you are not rules."),
    O("You showed up. Now show up complete."),
    O("A plan with exceptions is a suggestion. Decide which one this is."),
    O("Close enough is how a streak ends quietly."),
    O("Do the whole day, not the flattering half of it."),
    O("Tidy up the loose end before it becomes the habit."),
    O("The window you broke today is the one you will break tomorrow, unless you decide now."),
    O("Partial effort deserves partial credit. Aim for the full mark."),
    O("Your floor was met. Your standard was not. Raise one to meet the other."),
    ["Well begun is half done.", "traditional proverb"],
    ["Do what you can, with what you have, where you are.", "attributed to Theodore Roosevelt (who credited an earlier source)"],
    O("You are closer than yesterday. Do not stop at close.")
  ],
  hit: [
    O("Every box ticked. That is the standard now, not the exception."),
    O("Clean day. Now do better, because tomorrow does not care about today."),
    O("You did what you said. Do it again, a little harder."),
    O("Proof, not promise. Keep stacking it."),
    O("A good day is a deposit. Make another one tomorrow."),
    O("The easy part is hitting it once. The real test starts tomorrow."),
    O("Do not celebrate the minimum. Raise it."),
    O("You earned tonight. You did not earn the week yet."),
    O("Consistency is boring. Be boring for another day."),
    O("Hit the goal, then ask what the goal was hiding."),
    O("Well done. Now go to sleep on time so tomorrow can be the same."),
    O("The version of you that followed through is the one to copy."),
    O("You were reliable today. Be reliable again."),
    O("Repeat the day you just had. That is the whole secret, and the hard part."),
    ["Well done is better than well said.", "attributed to Benjamin Franklin"],
    O("Today is evidence. Use it the next time your head argues.")
  ],
  streak: [
    O("A streak is a promise you keep making. Make it again today."),
    O("Days in a row is how a decision becomes who you are."),
    O("You are not on a streak, you are building a record. Protect it."),
    O("The chain is only as strong as the next link. Forge it."),
    O("Momentum is borrowed from yesterday and repaid today."),
    O("Do not break the run on the day it feels easy to skip."),
    O("This is what discipline looks like when nobody claps."),
    O("Each day you do not quit makes quitting harder to justify."),
    O("The streak is not the goal. It is the evidence you are serious."),
    O("The hard days are the ones that count double. Do not skip them."),
    O("Keep the chain. Raise the bar quietly."),
    O("A long run is just a lot of ordinary days refused to skip."),
    O("You have built something. Do not hand it back for one skipped day."),
    O("First you make the habit. Then the habit carries you on the days you cannot carry yourself."),
    O("Another day, another link. Nobody notices one. Everybody notices the chain."),
    O("The next day is the only day that can extend this. Go and get it.")
  ]
};
export const QUOTE_TIERS = Object.keys(FIT_QUOTES);
export const QUOTE_COUNT = QUOTE_TIERS.reduce((n, t) => n + FIT_QUOTES[t].length, 0);
