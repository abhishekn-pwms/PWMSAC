// AC v2.0 BANKNDEPOSITS

const MASTERS = {

    PORTFOLIO_TYPES: [
        "Work",
        "Personal"
    ],

    ACTIVITY_STATUS: [
        "Not Started",
        "In Progress",
        "Completed",
        "On Hold",
        "Cancelled"
    ],

    LOG_TYPES: [
        "Meeting",
        "Call",
        "Email",
        "Discussion",
        "Review",
        "Research",
        "Planning",
        "Proposal",
        "Demo",
        "Approval",
        "Follow-up",
        "Personal"
    ],

    EFFORT_TYPES: [
        "Planned",
        "Unplanned"
    ],

    VALUE_TYPES: [
        "Progress",
        "Achievement",
        "Risk",
        "Issue",
        "Decision",
        "Dependency",
        "Follow-up"
    ],


    ACTIVITY_PRIORITY: [
        "Low",
        "Medium",
        "High",
        "Critical"
    ],

    MILESTONE_STATUS: [
        "Not Started",
        "In Progress",
        "Completed",
        "On Hold",
        "Cancelled"
    ],

    // Deposits. Status is not a form field — it only changes through the
    // hidden Close this deposit actions — so DEPOSIT_STATUS documents the
    // allowed values rather than feeding an editable dropdown.
    DEPOSIT_TYPES: [
        "RD",
        "FD"
    ],

    DEPOSIT_TENURES: [
        6,
        12,
        15,
        18,
        24,
        36
    ],

    DEPOSIT_STATUS: [
        "Active",
        "Completed",
        "Closed early"
    ],

    // People and insurance
    PERSON_RELATIONSHIPS: [
        "Self",
        "Spouse",
        "Child",
        "Parent"
    ],

    INSURANCE_TYPES: [
        "Life",
        "Medical",
        "Motor"
    ],

    INSURANCE_STATUS: [
        "Active",
        "Closed"
    ],

    PREMIUM_MODES: [
        "Annual",
        "Half Yearly",
        "Quarterly",
        "Monthly",
        "Single payment"
    ],

    // Document categories for the Attachments section, per record type.
    // The first entry is the default. Add or reword freely -- they are
    // stored as plain text on each file.
    ATTACHMENT_DOC_TYPES: {
        insurance_policy: [
            "Policy document",
            "Medical records",
            "Premium receipt",
            "Claim",
            "Other"
        ],
        deposit: [
            "Deposit advice",
            "Other"
        ],
        bank_account: [
            "Passbook or statement",
            "Cheque",
            "Other"
        ],
        person: [
            "Other"
        ],
        identity_document: [
            "Front",
            "Back",
            "Other"
        ],
        card: [
            "Other"
        ],
        locker: [
            "Agreement",
            "Rent receipt",
            "Other"
        ],
        contact: [
            "Other"
        ],
        mf_holding: [
            "Statement",
            "Account opening form",
            "Other"
        ]
    },

    // Vault
    IDENTITY_DOC_TYPES: [
        "PAN",
        "Aadhaar",
        "Passport",
        "Driving licence",
        "Voter ID",
        "Other"
    ],

    CARD_TYPES: [
        "Debit",
        "Credit"
    ],

    // Mutual funds
    MF_STATUS: [
        "Active",
        "Locked",
        "Redeemed"
    ],

    MF_MODES: [
        "Lumpsum",
        "SIP (Monthly)"
    ],

    MF_HOLDING_PATTERNS: [
        "Single",
        "Joint",
        "Either or survivor"
    ]


};