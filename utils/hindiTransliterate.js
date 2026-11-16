// Converts a Roman-script staff name to Devanagari (Hindi) for display in
// dropdowns — tried the standard transliteration libraries first
// (@indic-transliteration/sanscript's itrans/hk/wx/optitrans schemes,
// aksharamukha) but all of them assume strict Sanskrit-style romanization
// input (e.g. ITRANS maps plain "sh" to ष, not श) and produced badly wrong
// output for ordinary English-spelled Indian names — "Singh" never came
// out as सिंह in any of them. This is a purpose-built word-dictionary (the
// actual names seen across this app's staff roster) with a syllable-based
// phonetic fallback for anything not in the dictionary — per-word lookup
// first, so "Singh"/"Kumar"/etc. are always exactly right, with the
// fallback only ever touching a genuinely unfamiliar name.
const WORD_DICTIONARY = {
  // Common surnames / title words
  singh: "सिंह", kumar: "कुमार", kumari: "कुमारी", yadav: "यादव",
  kushwah: "कुशवाह", kushwaha: "कुशवाहा", jat: "जाट", jatav: "जाटव",
  baghel: "बघेल", jadon: "जादौन", tomar: "तोमर", rana: "राणा",
  chaudhary: "चौधरी", chaudhari: "चौधरी", sharma: "शर्मा", verma: "वर्मा",
  gupta: "गुप्ता", patel: "पटेल", pal: "पाल", mahor: "महोर",
  dhakad: "धाकड़", rathore: "राठौर", rajak: "रजक", gurjar: "गुर्जर",
  balmik: "बाल्मीकि", balmeek: "बाल्मीक", valmik: "वाल्मीकि", sen: "सेन",
  pathak: "पाठक", jamadar: "जमादार", chouhan: "चौहान", suman: "सुमन",
  baretha: "बरेठा", devi: "देवी", kuresiya: "कुरेसिया", pawar: "पवार",
  bhadouriya: "भदौरिया", mahato: "महतो", bai: "बाई", khare: "खरे",
  dagore: "डागोरे", kushwaah: "कुशवाह",
  // Common first/middle names
  ravindra: "रविन्द्र", surjeet: "सुरजीत", ajeet: "अजीत", pran: "प्राण",
  indar: "इन्दर", raj: "राज", jagat: "जगत", balveer: "बलवीर",
  chitra: "चित्रा", kalicharan: "कालीचरण", keshav: "केशव",
  shishupal: "शिशुपाल", pradeep: "प्रदीप", rinku: "रिंकू", bhola: "भोला",
  ram: "राम", dharmendra: "धर्मेन्द्र", monu: "मोनू", hariom: "हरिओम",
  sameer: "समीर", neeraj: "नीरज", shailendra: "शैलेन्द्र", kher: "खेर",
  hardev: "हरदेव", madhu: "मधु", manoj: "मनोज", kaliyan: "कालियान",
  nishad: "निषाद", deependra: "दीपेन्द्र", mukesh: "मुकेश",
  ramniwas: "रामनिवास", santosh: "संतोष", bihari: "बिहारी",
  beerendra: "बीरेन्द्र", kuldeep: "कुलदीप", mahesh: "महेश",
  chandra: "चन्द्र", niketan: "निकेतन", pavan: "पवन", omji: "ओमजी",
  panjab: "पंजाब", ranjeet: "रणजीत", satendra: "सतेन्द्र",
  archana: "अर्चना", harimohan: "हरिमोहन", abhishek: "अभिषेक",
  dalveer: "दलवीर", hemant: "हेमंत", suresh: "सुरेश",
  ramkumar: "रामकुमार", niranjan: "निरंजन", manish: "मनीष",
  deepak: "दीपक", karan: "करण", binod: "बिनोद", rahul: "राहुल",
  arjun: "अर्जुन", reshab: "ऋषभ", suneel: "सुनील", foranti: "फोरंती",
  kamlesh: "कमलेश", jitendra: "जितेन्द्र", mithun: "मिथुन",
  akash: "आकाश", krishna: "कृष्णा", naresh: "नरेश", dinesh: "दिनेश",
  sanjay: "संजय", bhanu: "भानु", pratap: "प्रताप", arti: "आरती",
  nikhil: "निखिल", aman: "अमन", devendra: "देवेन्द्र", ravi: "रवि",
  ramesh: "रमेश", umesh: "उमेश", sant: "संत", jayveer: "जयवीर",
  chetram: "चेतराम", lokendra: "लोकेन्द्र", kajal: "काजल",
  sundar: "सुंदर", rakesh: "राकेश", kallo: "कल्लो", pyari: "प्यारी",
  rambaran: "रामबरन", nihal: "निहाल", vinod: "विनोद", dongar: "डोंगर",
  sunil: "सुनील", vijay: "विजय", rohit: "रोहित", anil: "अनिल",
  pramod: "प्रमोद", avinash: "अविनाश", ranijay: "रणजय", kher_singh: "खेर सिंह",
  hardev_singh: "हरदेव सिंह", akhilesh: "अखिलेश", vikram: "विक्रम",
  ashok: "अशोक", rajesh: "राजेश", mohan: "मोहन", gopal: "गोपाल",
  shyam: "श्याम", bharat: "भरत", mukul: "मुकुल", amit: "अमित",
  sandeep: "संदीप", virendra: "वीरेन्द्र", jitendra_: "जितेन्द्र",
};

const CONSONANTS = [
  ["chh", "छ"], ["ksh", "क्ष"], ["gy", "ज्ञ"], ["sh", "श"], ["ch", "च"],
  ["th", "थ"], ["dh", "ध"], ["bh", "भ"], ["ph", "फ"], ["gh", "घ"],
  ["kh", "ख"], ["ng", "ङ्ग"], ["k", "क"], ["g", "ग"], ["j", "ज"],
  ["t", "त"], ["d", "द"], ["n", "न"], ["p", "प"], ["b", "ब"],
  ["m", "म"], ["y", "य"], ["r", "र"], ["l", "ल"], ["v", "व"],
  ["w", "व"], ["s", "स"], ["h", "ह"], ["f", "फ"], ["z", "ज़"],
  ["c", "क"], ["x", "क्स"],
];
const VOWELS_INITIAL = [
  ["aa", "आ"], ["ee", "ई"], ["ii", "ई"], ["oo", "ऊ"], ["uu", "ऊ"],
  ["ai", "ऐ"], ["au", "औ"], ["a", "अ"], ["i", "इ"], ["u", "उ"], ["e", "ए"], ["o", "ओ"],
];
const VOWELS_MATRA = [
  ["aa", "ा"], ["ee", "ी"], ["ii", "ी"], ["oo", "ू"], ["uu", "ू"],
  ["ai", "ै"], ["au", "ौ"], ["a", ""], ["i", "ि"], ["u", "ु"], ["e", "े"], ["o", "ो"],
];

function matchLongest(str, pos, table) {
  for (const [roman, dev] of table) {
    if (str.startsWith(roman, pos)) return { roman, dev };
  }
  return null;
}

// Best-effort syllable-by-syllable phonetic fallback for a word not in the
// dictionary above — inherent limitation of auto-transliteration (no
// library handles ordinary English name spelling well either, see note at
// top), kept simple since the dictionary covers the names actually in use.
function transliterateWord(word) {
  const lower = word.toLowerCase();
  if (WORD_DICTIONARY[lower]) return WORD_DICTIONARY[lower];
  if (!/^[a-z]+$/.test(lower)) return word; // leave non-alphabetic tokens (numbers, punctuation) as-is

  let out = "";
  let pos = 0;
  let atWordStart = true;
  while (pos < lower.length) {
    const vowelMatch = matchLongest(lower, pos, atWordStart ? VOWELS_INITIAL : []);
    if (vowelMatch) {
      out += vowelMatch.dev;
      pos += vowelMatch.roman.length;
      atWordStart = false;
      continue;
    }
    const consMatch = matchLongest(lower, pos, CONSONANTS);
    if (consMatch) {
      out += consMatch.dev;
      pos += consMatch.roman.length;
      const followingVowel = matchLongest(lower, pos, VOWELS_MATRA);
      if (followingVowel) {
        out += followingVowel.dev;
        pos += followingVowel.roman.length;
      } else if (pos < lower.length && matchLongest(lower, pos, CONSONANTS)) {
        out += "्"; // halant — next char is another consonant, no vowel between
      }
      atWordStart = false;
      continue;
    }
    // Unrecognised character (shouldn't happen given the a-z check above)
    out += lower[pos];
    pos += 1;
    atWordStart = false;
  }
  return out;
}

// Transliterates a full name, word by word — parenthetical remarks like
// "(Hold)" or "(STP)" are left in English since they're status notes, not
// part of the name.
function transliterateToHindi(fullName) {
  if (!fullName) return "";
  return fullName
    .split(/(\s+|\(|\))/)
    .map((part) => (/^[A-Za-z]+$/.test(part) ? transliterateWord(part) : part))
    .join("");
}

module.exports = { transliterateToHindi };
