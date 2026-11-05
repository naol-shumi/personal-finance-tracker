// parser.js
// Reads transaction message text and returns what it found.
// This file never touches the web page. It only works with text.
//
// IMPORTANT: the message formats this was written for are INVENTED examples.
// Real banks and mobile money providers will need their own parser function.

// ---------- Small helper functions ----------

// "1,500.50" -> 150050 (whole cents)
function parseAmountToCents(text) {
    const cleaned = text.replace(/,/g, "");
    return Math.round(parseFloat(cleaned) * 100);
  }
  
  // Does the text contain any of these words? (whole words only, ignoring case)
  function hasAnyWord(text, words) {
    const pattern = new RegExp("\\b(" + words.join("|") + ")\\b", "i");
    return pattern.test(text);
  }
  
  // Finds every money amount in the text, except balances, fees and charges.
  // Returns a list like [{ cents: 150000, display: "1,500.00" }]
  function findAmounts(text) {
    // Matches "ETB 1,500.00", "Birr 200", "ETB1500" and "1,500.00 ETB"
    const pattern =
      /\b(?:ETB|Birr|Br)(?![A-Za-z])\.?\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:ETB|Birr|Br)(?![A-Za-z])/gi;
  
    const found = [];
    for (const match of text.matchAll(pattern)) {
      const numberText = match[1] || match[2];
  
      // Look at the 25 characters before the amount.
      const before = text.slice(Math.max(0, match.index - 25), match.index).toLowerCase();
      if (before.includes("balance") || before.includes("fee") || before.includes("charge")) {
        continue; // skip: this number is a balance, fee or charge
      }
  
      found.push({ cents: parseAmountToCents(numberText), display: numberText });
    }
    return found;
  }
  
  // Finds a date. Returns { date: "2026-10-12", assumed: true/false } or null.
  function findDate(text) {
    // Format 1: 2026-10-12
    const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) {
      const month = Number(iso[2]);
      const day = Number(iso[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return { date: iso[0], assumed: false };
      }
    }
  
    // Format 2: 12/10/2026, read as DAY/MONTH/YEAR
    const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (slash) {
      const day = Number(slash[1]);
      const month = Number(slash[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const mm = String(month).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        // If both numbers could be a month, we cannot be 100% sure which is which.
        const unsure = day <= 12;
        return { date: slash[3] + "-" + mm + "-" + dd, assumed: unsure };
      }
    }
  
    return null;
  }
  
  // ---------- The generic parser ----------
  
  function genericParser(text) {
    const warnings = [];
  
    // 1. Income or expense?
    const incomeWords = ["credited", "received", "deposited", "deposit"];
    const expenseWords = ["debited", "sent", "paid", "payment", "purchase", "withdrawn", "withdrawal", "transferred"];
    const looksLikeIncome = hasAnyWord(text, incomeWords);
    const looksLikeExpense = hasAnyWord(text, expenseWords);
  
    let type = null;
    if (looksLikeIncome && !looksLikeExpense) type = "income";
    if (looksLikeExpense && !looksLikeIncome) type = "expense";
    if (type === null) {
      warnings.push("We could not tell for sure whether this is income or expense. Please choose.");
    }
  
    // 2. Amount (only if there is exactly one clear candidate)
    const amounts = findAmounts(text);
    let amountCents = null;
    if (amounts.length === 1) {
      amountCents = amounts[0].cents;
    } else if (amounts.length === 0) {
      warnings.push("We could not find an amount. Please enter it.");
    } else {
      const list = amounts.map(function (a) { return a.display; }).join(", ");
      warnings.push("We found more than one possible amount (" + list + "). Please enter the correct one.");
    }
  
    // 3. Currency (we only support ETB for now)
    const currency = "ETB";
    if (!/\b(ETB|Birr|Br)(?![A-Za-z])/i.test(text)) {
      warnings.push("No currency found, so ETB was assumed.");
    }
  
    // 4. Date
    const dateResult = findDate(text);
    let date = "";
    if (dateResult === null) {
      warnings.push("No date found. Please choose one.");
    } else {
      date = dateResult.date;
      if (dateResult.assumed) {
        warnings.push("The date was read as day/month/year. Please check it.");
      }
    }
  
    // 5. Reference number
    let reference = "";
    const refMatch = text.match(
      /(?:Ref(?:erence)?(?:\s*(?:No\.?|Number))?|Transaction\s*ID|Txn\s*ID)\s*[:#.]?\s*([A-Za-z0-9]{6,})/i
    );
    if (refMatch) reference = refMatch[1].toUpperCase();
  
    // 6. Sender or recipient: capital-letter names after "from" or "to"
    let party = "";
    const partyMatch = text.match(/\b(?:from|to)\s+([A-Z][A-Za-z'-]*(?:\s+[A-Z][A-Za-z'-]*)*)/);
    if (partyMatch) party = partyMatch[1];
  
    // 7. Description
    let description = "Message transaction";
    if (party !== "") {
      if (type === "income") description = "Received from " + party;
      else if (type === "expense") description = "Sent to " + party;
      else description = party;
    }
  
    return {
      type: type,
      amountCents: amountCents,
      currency: currency,
      date: date,
      reference: reference,
      description: description,
      warnings: warnings
    };
  }
  
  // ---------- The list of parsers ----------
  // Later, a parser for a specific bank goes BEFORE genericParser.
  // A specific parser returns a result when it recognizes the message,
  // or null when it does not. Then the next one in the list gets a try.
  const parsers = [
    genericParser
  ];
  
  function parseMessage(text) {
    for (const parser of parsers) {
      const result = parser(text);
      if (result !== null) return result;
    }
    return null;
  }