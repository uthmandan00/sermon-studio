export const sampleData = {
  meta: {
    version: 6,
    profile: {
      appName: "Sermon Studio",
      appSubtitle: "Sermon Manager",
      pastorName: "Pastor Jonathan",
      churchName: "Grace City Church",
      weeklyFocus: "Faithful preparation leads to powerful proclamation."
    },
    seededAt: "2026-05-21T00:00:00.000Z",
    recentSearches: [],
    activity: [
      {
        id: "act-001",
        type: "seed",
        message: "Sample workspace created with the Save Me series.",
        date: "2026-05-21T09:00:00.000Z"
      }
    ]
  },
  series: [
    {
      id: "series-save-me",
      title: "Save Me",
      subtitle: "Prayers for rescue, renewal, and courage",
      description: "A three-week journey through biblical cries for deliverance and the hope of God's saving presence.",
      themeScripture: "Psalm 18:2",
      themeStatement: "God does not merely improve us; he comes near to rescue, restore, and send us.",
      startDate: "2026-06-07",
      endDate: "2026-06-21",
      bannerColor: "#0f6b35",
      tags: ["Psalms", "Salvation", "Prayer"],
      sermonIds: ["sermon-save-me-1", "sermon-save-me-2", "sermon-save-me-3"],
      status: "Active",
      archived: false,
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-18T14:30:00.000Z"
    }
  ],
  sermons: [
    {
      id: "sermon-save-me-1",
      title: "When the Waters Rise",
      subtitle: "Learning to pray before we know what to say",
      seriesId: "series-save-me",
      weekNumber: 1,
      datePreached: "2026-06-07",
      location: "Grace Fellowship Church",
      speaker: "Pastor Daniel",
      mainScripture: "Psalm 69:1-3",
      supportingScriptures: "Matthew 14:22-33; Isaiah 43:1-2",
      scriptureBlocks: [
        {
          reference: "Psalm 69:1-3",
          text: "Save me, O God, for the waters have come up to my neck. I sink in deep mire, where there is no foothold."
        }
      ],
      bigIdea: "The first movement of faith in trouble is not explanation; it is honest prayer.",
      purpose: "Invite the congregation to bring unfiltered distress to God instead of hiding it from him.",
      fallenConditionFocus: "We often confuse strong faith with emotional silence.",
      introduction: "Most of us have had a moment where the normal scripts failed us. David gives us permission to start with the prayer we actually have.",
      outline: [
        {
          id: "blk-1",
          type: "Main Point",
          title: "Name the waters honestly",
          body: "Biblical faith does not require pretending the flood is ankle deep when it is at your neck."
        },
        {
          id: "blk-2",
          type: "Illustration",
          title: "The basement after the storm",
          body: "A family does not debate the philosophy of rain while water is coming through the walls; they call for help."
        },
        {
          id: "blk-3",
          type: "Application",
          title: "Pray the real prayer",
          body: "This week, write one sentence to God that begins, 'Lord, this is where I feel overwhelmed...'"
        }
      ],
      transitions: "If God welcomes the honest prayer, then we can stop editing ourselves before we come to him.",
      illustrations: "Flooded basement; Peter stepping onto the water; a hospital waiting room prayer.",
      applications: "Practice one unedited lament; pray with someone before solving them.",
      quotes: "Prayer is the place where honesty becomes hope.",
      conclusion: "The water may be high, but the Savior is not far off.",
      invitation: "Come to Christ with the prayer you actually have.",
      personalNotes: "Leave room after point two for pastoral silence.",
      researchNotes: "Compare Psalm 69 with Jonah 2 and Matthew's sea narratives.",
      commentaryReferences: "Kidner on Psalms; Goldingay, Psalms Volume 2.",
      prayerNotes: "Pray for people carrying private panic.",
      outputNotes: {
        handout: "Leave space for people to write one honest prayer of lament.",
        slides: "Use a simple water image, then one slide for each movement: Name, Pray, Hope.",
        discussion: "Invite the group to distinguish honest lament from hopeless complaint."
      },
      prepChecklist: {
        manuscript: true,
        slides: false,
        handout: true,
        discussion: false,
        prayer: true,
        print: false,
        preachReady: false
      },
      tags: ["lament", "prayer", "rescue"],
      topics: ["Anxiety", "Deliverance", "Faith"],
      status: "Ready",
      estimatedLength: 32,
      audience: "Sunday morning congregation",
      favorite: true,
      pinned: true,
      archived: false,
      createdAt: "2026-05-04T12:00:00.000Z",
      updatedAt: "2026-05-20T16:45:00.000Z"
    },
    {
      id: "sermon-save-me-2",
      title: "Rescued for Renewal",
      subtitle: "Grace that saves us and remakes us",
      seriesId: "series-save-me",
      weekNumber: 2,
      datePreached: "2026-06-14",
      location: "Grace Fellowship Church",
      speaker: "Pastor Daniel",
      mainScripture: "Titus 3:3-8",
      supportingScriptures: "Ezekiel 36:25-27; 2 Corinthians 5:17",
      scriptureBlocks: [
        {
          reference: "Titus 3:5",
          text: "He saved us, not because of works done by us in righteousness, but according to his own mercy."
        }
      ],
      bigIdea: "God's rescue is not only pardon from guilt; it is renewal of the whole person.",
      purpose: "Help listeners trust mercy as the source of lasting transformation.",
      fallenConditionFocus: "We try to renovate ourselves with shame, effort, or image management.",
      introduction: "A rescue story is incomplete if the person pulled from danger is left without care.",
      outline: [
        {
          id: "blk-4",
          type: "Main Point",
          title: "Mercy is the root",
          body: "Paul grounds salvation in God's mercy, not our moral resume."
        },
        {
          id: "blk-5",
          type: "Main Point",
          title: "Renewal is the fruit",
          body: "The Spirit washes and renews, creating a new pattern of life."
        },
        {
          id: "blk-6",
          type: "Discussion Question",
          title: "Where are you performing?",
          body: "What part of your life is still trying to earn what Christ has already given?"
        }
      ],
      transitions: "Once mercy becomes the root, obedience becomes fruit instead of performance.",
      illustrations: "Restored family table; old house with new foundation work.",
      applications: "Confess one area of self-salvation; receive prayer for renewal.",
      quotes: "Grace does not lower the call to holiness; it gives holiness a new home.",
      conclusion: "The mercy that found you is strong enough to form you.",
      invitation: "Receive the washing and renewal of the Holy Spirit.",
      personalNotes: "Be careful to distinguish effort from earning.",
      researchNotes: "Explore palingenesia in Titus 3:5.",
      commentaryReferences: "Towner, The Letters to Timothy and Titus.",
      prayerNotes: "Pray against spiritual exhaustion.",
      outputNotes: {
        handout: "Include Titus 3:5 and a short reflection prompt.",
        slides: "Mercy as root, renewal as fruit.",
        discussion: "Focus on grace-driven transformation instead of self-improvement."
      },
      prepChecklist: {
        manuscript: false,
        slides: false,
        handout: false,
        discussion: true,
        prayer: true,
        print: false,
        preachReady: false
      },
      tags: ["grace", "renewal", "salvation"],
      topics: ["Grace", "Sanctification", "Identity"],
      status: "Drafting",
      estimatedLength: 34,
      audience: "Sunday morning congregation",
      favorite: false,
      pinned: false,
      archived: false,
      createdAt: "2026-05-07T13:00:00.000Z",
      updatedAt: "2026-05-19T11:15:00.000Z"
    },
    {
      id: "sermon-save-me-3",
      title: "Sent After Rescue",
      subtitle: "The saved become witnesses",
      seriesId: "series-save-me",
      weekNumber: 3,
      datePreached: "2026-06-21",
      location: "Grace Fellowship Church",
      speaker: "Pastor Daniel",
      mainScripture: "Mark 5:18-20",
      supportingScriptures: "Psalm 107:1-2; Acts 1:8",
      scriptureBlocks: [
        {
          reference: "Mark 5:19",
          text: "Go home to your friends and tell them how much the Lord has done for you, and how he has had mercy on you."
        }
      ],
      bigIdea: "Jesus saves us into a story worth telling.",
      purpose: "Move the church from private gratitude to humble witness.",
      fallenConditionFocus: "We can receive mercy and still keep it hidden out of fear or shame.",
      introduction: "The healed man wants to climb into the boat with Jesus, but Jesus gives him a mission in familiar streets.",
      outline: [
        {
          id: "blk-7",
          type: "Main Point",
          title: "Mercy gives you a story",
          body: "The man's testimony is not polished, but it is personal and true."
        },
        {
          id: "blk-8",
          type: "Transition",
          title: "From boat to neighborhood",
          body: "Sometimes the holiest place to go is back home with a changed life."
        },
        {
          id: "blk-9",
          type: "Application",
          title: "Tell one mercy story",
          body: "Identify one person this week who needs to hear what the Lord has done for you."
        }
      ],
      transitions: "The Savior who calms our chaos also sends us with compassion.",
      illustrations: "A restored relationship; testimony night; returning to a familiar workplace.",
      applications: "Write a three-minute testimony; pray for courage to share it.",
      quotes: "Witness is not making yourself the hero; it is telling the truth about mercy.",
      conclusion: "You do not need a perfect story to point to a perfect Savior.",
      invitation: "Ask Jesus to turn rescue into witness.",
      personalNotes: "End with a quiet invitation for people to name their one person.",
      researchNotes: "Study Decapolis response in Mark 7.",
      commentaryReferences: "France, The Gospel of Mark.",
      prayerNotes: "Pray for evangelistic courage without pressure.",
      outputNotes: {
        handout: "Add a three-minute testimony template.",
        slides: "Use a map/home imagery sequence: rescued, returned, sent.",
        discussion: "Ask each person to name one person they can pray for."
      },
      prepChecklist: {
        manuscript: false,
        slides: false,
        handout: false,
        discussion: false,
        prayer: false,
        print: false,
        preachReady: false
      },
      tags: ["witness", "mission", "mercy"],
      topics: ["Evangelism", "Testimony", "Mission"],
      status: "Planning",
      estimatedLength: 30,
      audience: "Sunday morning congregation",
      favorite: false,
      pinned: false,
      archived: false,
      createdAt: "2026-05-08T09:00:00.000Z",
      updatedAt: "2026-05-16T10:20:00.000Z"
    }
  ]
};
