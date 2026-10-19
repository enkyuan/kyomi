/* oxlint-disable max-lines */
import type { ClassifierEvalCase } from "./classifier-eval-fixture";

/**
 * Stored-article calibration set: real articles sampled from a local Kyomi database (2026-10),
 * stratified across the 17 categories, with drafted labels. Text is trimmed to the opening the
 * classifier sees first. Cases marked `needsReview` were ambiguous or thin when labeled and
 * should be spot-checked before their labels are trusted. Never add these cases to the category
 * head's training labels.
 */
export const CLASSIFIER_EVAL_STORED_CASES: readonly ClassifierEvalCase[] = [
  {
    id: "stored-002aa22e",
    source: "stored",
    feedTitle: "Science for Sport",
    feedDescription: "The #1 Sports Science Resource",
    feedUrl: "https://www.scienceforsport.com/feed",
    feedSiteUrl: "https://www.scienceforsport.com/",
    sourceKind: "rss",
    itemTitle: "Can S&C Education Improve?",
    itemSummary:
      "This week in the world of sports science, S&C education, Maurten nutrition, Sinner's Wimbledon preparations. The post Can S&C Education Improve? appeared first on Science for Sport .",
    itemContentText:
      "This week in the world of sports science, here’s what happened… Can S&C education in the UK be improved? Breaking barriers through nutrition Jannik Sinner’s unusual Wimbledon preparation Can S&C education in the UK be improved? (Image: ChatGPT) A recent study shed light on S&C education in the UK by gathering insights from various stakeholders, including employers, university program leaders, students, and graduates. The goal was to identify the key elements that contribute",
    itemUrl: "https://www.scienceforsport.com/can-sc-education-improve/",
    expected: ["Sports"],
  },
  {
    id: "stored-002f6deb",
    source: "stored",
    feedTitle: "Conscious Lifestyle Magazine",
    feedDescription: "The Mind Body Spirit Magazine, Evolved.",
    feedUrl: "https://www.consciouslifestylemag.com/feed",
    feedSiteUrl: "https://www.consciouslifestylemag.com/",
    sourceKind: "rss",
    itemTitle: "Fall 2020 Issue Out Now",
    itemSummary:
      "Feature articles: The Keys to Vitality, Cleaning Your Brain of Toxins, The Spiritual Physics of a Unified Mind, The Age of Enlightenment and more... The post Fall 2020 Issue Out Now appeared first on Conscious Lifestyle Magazine .",
    itemContentText:
      "Fall 2020 Issue Out Now Conscious Lifestyle Magazine Share: 288 0 8 Digital Edition: Order Now Collectors Edition Print Issue: Coming Soon! THE KEYS TO VITALITY By Dr. Ben Reebs Learn the timeless keys to health, longevity, and vitality that transcend all health fads and hype. GLUTATHIONE: THE ULTIMATE ANTIOXIDANT By Dr. Nayan Patel Glutathione is all the rage right now and for good reason—research has shown it is essential to vibrant health. RECIPE: ORGANIC VEGAN TWIX BARS",
    itemUrl: "https://www.consciouslifestylemag.com/fall-2020-issue-out-now/",
    expected: [],
    needsReview: true,
    note: "Magazine issue announcement; health/spiritual contents",
  },
  {
    id: "stored-00845d1f",
    source: "stored",
    feedTitle: "LGBTQ+ Archives – Never Judge a Book by its Cover",
    feedDescription: "Reviewing Young Adult Fiction since 2012.",
    feedUrl: "https://neverjudgeabookbyitscover.co.uk/category/lgbtq/feed",
    feedSiteUrl: "https://neverjudgeabookbyitscover.co.uk/category/lgbtq",
    sourceKind: "rss",
    itemTitle: "Happy National Book Lovers Day with my ultimate favourite books!",
    itemSummary:
      "Happy Book Lovers Day my fellow readers! August 9th is National Book Lovers Day celebrating our favourite books and what it means to be a reader, to be a book lover. On my bookstagram I post about my favourite books all the time but not",
    itemContentText:
      "Happy Book Lovers Day my fellow readers! August 9th is National Book Lovers Day celebrating our favourite books and what it means to be a reader, to be a book lover. On my bookstagram I post about my favourite books all the time but not here. They do tend to change every so often especially this year where I’ve added at least 3 new favourites. But how does it become a favourite book? I have my own criteria when it comes to favourite books that I thought I would share. Yes it",
    itemUrl:
      "https://neverjudgeabookbyitscover.co.uk/2023/08/happy-national-book-lovers-day-with-my-ultimate-favourite-books.html",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-00a1babf",
    source: "stored",
    feedTitle: "Pants Magic",
    feedDescription:
      "Personal style, dressmaking, history of fashion - these are what I know and glad to share. Please sign up to get our news first.",
    feedUrl: "https://sewfitstyle.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://sewfitstyle.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Dressmaking: a work that matters for people who care.",
    itemSummary:
      "Dressmakers and their job Recently I was asked the question I love and hate: ‘So, what are you doing?’ It’s always easier to answer this question if your job title is your job, even if the title doesn’t cover your contribution to your",
    itemContentText:
      "Dressmakers and their job Recently I was asked the question I love and hate: ‘So, what are you doing?’ It’s always easier to answer this question if your job title is your job, even if the title doesn’t cover your contribution to your community and the world. As sewists, many of us have the added problem of almost feeling ashamed of the answer. When I tell people I do dressmaking, usual reaction is: ‘Oh, it’s the dying art…’ ; ‘Really, is anyone still doing this?’ or even",
    itemUrl: "https://sewfitstyle.blogspot.com/2018/11/dressmaking-work-that-matters-for.html",
    expected: ["Personal & Essays"],
    needsReview: true,
    note: "Personal essay on dressmaking as a job; could be none or Work",
  },
  {
    id: "stored-00b5438f",
    source: "stored",
    feedTitle: "Waite Endurance",
    feedDescription: "Waite Endurance",
    feedUrl: "https://waiteendurance.com/feed",
    feedSiteUrl: "https://waiteendurance.com/",
    sourceKind: "rss",
    itemTitle: "Nutrition Periodization for Endurance Performance",
    itemSummary:
      "As your physiological training demands change with your training objectives, your nutritional demands change as well. The basic principle of Nutrition Periodization is simply that: changing your dietary consumption to match that of your",
    itemContentText:
      "As your physiological training demands change with your training objectives, your nutritional demands change as well. The basic principle of Nutrition Periodization is simply that: changing your dietary consumption to match that of your training efforts. Periodizing your diet can be achieved on two levels. The first is the larger training block level of macro-cycles. The second is the smaller weekly level of day-to-day training in micro-cycles. The goal of periodizing your",
    itemUrl:
      "https://waiteendurance.com/2019/09/20/nutrition-periodization-for-endurance-performance/",
    expected: ["Sports", "Health & Medicine"],
    needsReview: true,
    note: "Sports nutrition: Sports vs Health & Medicine",
  },
  {
    id: "stored-01f342e2",
    source: "stored",
    feedTitle: "The Grether Group",
    feedDescription:
      "Your expert source of information on buying, selling and Malibu real estate, Malibu homes for sale, Malibu Vacant Land",
    feedUrl: "https://malibuluxuryrealty.com/feed",
    feedSiteUrl: "https://malibuluxuryrealty.com/",
    sourceKind: "rss",
    itemTitle: "Malibu District 29: Water Infrastructure and Emergency Planning Updates",
    itemSummary:
      "As Malibu continues to evolve and rebuild, its water system quietly plays a big role in both daily life and long-term property value. At a recent City Council meeting, Los Angeles County Waterworks District 29, which serves the Malibu",
    itemContentText:
      "As Malibu continues to evolve and rebuild, its water system quietly plays a big role in both daily life and long-term property value. At a recent City Council meeting, Los Angeles County Waterworks District 29, which serves the Malibu region, shared an in-depth update on ongoing water-system upgrades, emergency response planning, and infrastructure improvements that […] The post Malibu District 29: Water Infrastructure and Emergency Planning Updates by Nikki Hutcheson",
    itemUrl:
      "https://malibuluxuryrealty.com/malibu-district-29-water-infrastructure-emergency-planning/",
    expected: ["World & Society", "Politics & Policy"],
    needsReview: true,
    note: "Local water infrastructure update; local news vs government",
  },
  {
    id: "stored-036b568f",
    source: "stored",
    feedTitle: "SitePoint",
    feedDescription:
      "Learn CSS | HTML5 | JavaScript | Wordpress | Tutorials-Web Development | Reference | Books and More",
    feedUrl: "https://www.sitepoint.com/sitepoint.rss",
    feedSiteUrl: "https://www.sitepoint.com/",
    sourceKind: "rss",
    itemTitle: "Building Production MCP Servers in TypeScript",
    itemSummary:
      "Learn how to architect, deploy, and maintain a resilient, stateful Model Context Protocol (MCP) server in TypeScript that handles reconnects, long-lived tool sessions, and schema validation without leaking memory or crashing agent",
    itemContentText:
      "Learn how to architect, deploy, and maintain a resilient, stateful Model Context Protocol (MCP) server in TypeScript that handles reconnects, long-lived tool sessions, and schema validation without leaking memory or crashing agent sessions. Continue reading Building Production MCP Servers in TypeScript on SitePoint .",
    itemUrl:
      "https://www.sitepoint.com/building-production-mcp-servers-in-typescript/?utm_source=rss",
    expected: ["Software Engineering", "AI & ML"],
  },
  {
    id: "stored-042b54c7",
    source: "stored",
    feedTitle: "Texas Kidney Institute",
    feedDescription: "Texas Kidney Institute (TKI)",
    feedUrl: "https://texaskidneyinstitute.com/feed",
    feedSiteUrl: "https://texaskidneyinstitute.com/",
    sourceKind: "rss",
    itemTitle: "Best Foods for a Renal Diet and Your Go-To Grocery List",
    itemSummary:
      "Living with chronic kidney disease (CKD) in the Dallas-Fort Worth area means navigating a world of flavorful foods, from savory Tex-Mex to classic Texas BBQ. The good news is that protecting your kidney health doesn’t mean giving up",
    itemContentText:
      "Living with chronic kidney disease (CKD) in the Dallas-Fort Worth area means navigating a world of flavorful foods, from savory Tex-Mex to classic Texas BBQ. The good news is that protecting your kidney health doesn’t mean giving up delicious meals. It’s about making smarter, kidney-friendly choices. At Texas Kidney Institute, our nephrologists and dietitians are here to help you create a personalized nutrition plan that works for your health and your lifestyle.",
    itemUrl: "https://texaskidneyinstitute.com/best-foods-for-a-renal-diet/",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-055669cf",
    source: "stored",
    feedTitle: "Quadrant 2 design | Exhibiting Guides",
    feedDescription:
      "Quadrant2Design create exhibition stands in the exclusive Prestige Events System. Read some great tips and advice in these exhibition stand guides from leading designers Quadrant2Design.",
    feedUrl: "https://www.quadrant2design.com/exhibiting-guides/feed",
    feedSiteUrl: "https://www.quadrant2design.com/exhibiting-guides/",
    sourceKind: "rss",
    itemTitle: "How to Exhibit in the UK from Abroad Successfully",
    itemSummary: null,
    itemContentText: null,
    itemUrl: "https://www.quadrant2design.com/exhibiting-in-uk-from-abroad/",
    expected: ["Business & Startups"],
    needsReview: true,
    note: "Empty text; title-only trade show guide",
  },
  {
    id: "stored-058a149d",
    source: "stored",
    feedTitle: "Yorkshire Food Guide",
    feedDescription: "The best Yorkshire Restaurants, Street Food, Events & Offers",
    feedUrl: "https://yorkshirefoodguide.co.uk/feed",
    feedSiteUrl: "https://yorkshirefoodguide.co.uk/",
    sourceKind: "rss",
    itemTitle: "Sora York Afternoon Tea with a Cocktail",
    itemSummary:
      "One voucher per person The post Sora York Afternoon Tea with a Cocktail appeared first on Yorkshire Food Guide .",
    itemContentText:
      "One voucher per person The post Sora York Afternoon Tea with a Cocktail appeared first on Yorkshire Food Guide .",
    itemUrl: "https://yorkshirefoodguide.co.uk/book/sora-york-afternoon-tea-offer/",
    expected: ["Food & Travel"],
    needsReview: true,
    note: "Thin promo voucher listing; could be none",
  },
  {
    id: "stored-0597aff3",
    source: "stored",
    feedTitle: "🍑 Peachleaf Street – Make family memories that last a lifetime",
    feedDescription: "UK Family Travel, bucket lists, London for kids",
    feedUrl: "https://peachleafstreet.com/feed",
    feedSiteUrl: "https://peachleafstreet.com/",
    sourceKind: "rss",
    itemTitle:
      "Buy the cheapest tickets for Disneyland Paris park with these expert secrets (and have more money for Mickey snacks!)",
    itemSummary: "Learn how many days you ACTUALLY need for Disney in Paris",
    itemContentText:
      "When I was organising my first Disneyland Paris trip from the UK, I felt overwhelmed by park ticket choices. Figuring out the cheapest and best value tickets for my family took trial and error (and a bit of luck!). Here I want to share all the secrets I discovered to getting the cheapest tickets for Disneyland Paris park. No matter how many days you are planning to visit, it is a trip you will remember for a lifetime! As with any price comparison, there will be different",
    itemUrl: "https://peachleafstreet.com/disney/dlp/tickets-for-disneyland-paris-park/",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-05eb7ba8",
    source: "stored",
    feedTitle: "www.nola.com - RSS Results in sports/saints of type article",
    feedDescription:
      "www.nola.com - RSS Results in section(s) sports/saints only for asset type(s) of article",
    feedUrl:
      "https://www.nola.com/search?f=rss&t=article&c=sports/saints&l=50&s=start_time&sd=desc",
    feedSiteUrl:
      "https://www.nola.com/search/?f=rss&t=article&c=sports/saints&l=50&s=start_time&sd=desc",
    sourceKind: "rss",
    itemTitle:
      "Reflecting on three formative seasons, Kellen Moore has a 'little soft spot' for Detroit",
    itemSummary: "Kellen Moore likes to joke that he was an “eighth-rounder.”",
    itemContentText: "Kellen Moore likes to joke that he was an “eighth-rounder.”",
    itemUrl:
      "https://www.nola.com/sports/saints/reflecting-on-three-formative-seasons-kellen-moore-has-a-little-soft-spot-for-detroit/article_be9b9168-0061-42d7-b0ba-f3c3d440c4f0.html",
    expected: ["Sports"],
  },
  {
    id: "stored-060e54ea",
    source: "stored",
    feedTitle: "App Developer Magazine",
    feedDescription: "News for app developers and the software industry",
    feedUrl: "https://appdevelopermagazine.com/RSS",
    feedSiteUrl: "https://appdevelopermagazine.com/news",
    sourceKind: "rss",
    itemTitle: "Spotify and UMG strike landmark AI music licensing deal",
    itemSummary:
      "For years, fan made covers and remixes have lived in a legal gray zone. Creators moved fast. Rights lagged. Platforms patched around the edges. This deal recognizes the obvious and does something useful about it. Spotify will offer a",
    itemContentText:
      "For years, fan made covers and remixes have lived in a legal gray zone. Creators moved fast. Rights lagged. Platforms patched around the edges. This deal recognizes the obvious and does something useful about it. Spotify will offer a generative AI powered creation tool as a paid add on for Premium u",
    itemUrl:
      "https://appdevelopermagazine.com/Spotify-and-UMG-strike-landmark-AI-music-licensing-deal/",
    expected: ["Culture & Media", "AI & ML"],
  },
  {
    id: "stored-0627d77b",
    source: "stored",
    feedTitle: "Nick Farrell | Golden Dawn, Ritual Magic and Western Esotericism",
    feedDescription:
      "Golden Dawn, ceremonial magic, occult history and the Western Mystery Tradition",
    feedUrl: "https://www.nickfarrell.it/feed",
    feedSiteUrl: "https://www.nickfarrell.it/",
    sourceKind: "rss",
    itemTitle: "AI does not mean the death of creativity",
    itemSummary:
      "No one has more reason to hate AI than me. It has cost me two jobs and made my life difficult. However, I am also a user of it magically and otherwise. This has put me at odds with those who are trying to rationalise their terror of",
    itemContentText:
      "No one has more reason to hate AI than me. It has cost me two jobs and made my life difficult. However, I am also a user of it magically and otherwise. This has put me at odds with those who are trying to rationalise their terror of technology as magic or other issues. In most cases, showing ignorance of how it works and its impact. The technology, as it exists now, however clever, is like an autocorrect. It uses existing data to guess what the next line in the word should",
    itemUrl: "https://www.nickfarrell.it/ai-does-not-mean-the-death-of-creativity/",
    expected: ["AI & ML", "Personal & Essays"],
    needsReview: true,
    note: "Personal essay on AI and occult creativity; AI vs Personal",
  },
  {
    id: "stored-06942ea1",
    source: "stored",
    feedTitle: "Blog - Sylvester Cabinetry",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "http://sylvestercustomcabinetry.com/blog?format=rss",
    feedSiteUrl: "http://sylvestercustomcabinetry.com/blog/",
    sourceKind: "rss",
    itemTitle: "Home Office Design and Organization!",
    itemSummary:
      "Did someone say “home office”? I feel like in 2020 a home office is more prevalent than ever. Whether you have had to work from home, your kid has had to do school work, or maybe you just want some more home organization, a home office",
    itemContentText:
      "Did someone say “home office”? I feel like in 2020 a home office is more prevalent than ever. Whether you have had to work from home, your kid has had to do school work, or maybe you just want some more home organization, a home office would be the answer for you. Just because you hear the word office, doesn’t mean you have to have a whole room just for the office. Something just having a designated space for your stuff makes it that much easier. Your first questions might",
    itemUrl:
      "http://sylvestercustomcabinetry.com/blog/2020/9/30/home-office-design-and-organization",
    expected: ["Design & UX"],
    needsReview: true,
    note: "Home organization/cabinetry marketing; Design vs none",
  },
  {
    id: "stored-075d2490",
    source: "stored",
    feedTitle: "Radio Times",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.radiotimes.com/movies/feed",
    feedSiteUrl: "https://www.radiotimes.com/movies",
    sourceKind: "rss",
    itemTitle:
      "The Cigarette Surfboard review: An informative, entertaining and heartwarming environment documentary",
    itemSummary:
      "The documentary follows a surfer who builds a functional surfboard with 10,000 cigarette butts collected from California beaches.",
    itemContentText:
      "Beaches and shorelines the world over are under attack from the waste humankind leaves in its wake, and discarded cigarette filters rank among the most perniciously invasive of blots on the landscape. Enter California surfer and activist Taylor Lane, to highlight the issue in attention-grabbing fashion – by building a surfboard made of said cigarette butts. It’s the stuff of off-the-wall “and finally” reports at the close of news bulletins, perhaps, yet beyond the initial",
    itemUrl: "https://www.radiotimes.com/movies/the-cigarette-surfboard-review/",
    expected: ["Culture & Media", "Climate & Environment"],
  },
  {
    id: "stored-07858138",
    source: "stored",
    feedTitle: "Published Content Feed | Manufacturing.net",
    feedDescription: "The latest published content from Manufacturing.net",
    feedUrl:
      "https://www.manufacturing.net/__rss/all-published-content.xml?input=%7B%22pagination%22%3A%7B%22limit%22%3A50%7D%2C%22contentTypes%22%3A%5B%22Article%22%2C%22News%22%2C%22Blog%22%2C%22PressRelease%22%2C%22Video%22%5D%7D",
    feedSiteUrl: "https://www.manufacturing.net/",
    sourceKind: "rss",
    itemTitle: "Cable Manufacturer Prysmian Announces $1.2B Investment Across Three States",
    itemSummary:
      "The projects build on the company's position in the data center construction market",
    itemContentText:
      "The projects build on the company's position in the data center construction market",
    itemUrl:
      "https://www.manufacturing.net/energy/news/22972298/cable-manufacturer-prysmian-announces-12b-investment-across-three-states",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-07c46c06",
    source: "stored",
    feedTitle: "Mercy For Animals Blog",
    feedDescription:
      "Get the latest news from the world of farmed animals, animal protection, and vegan eating. Mercy For Animals is an international non-profit animal advocacy organization dedicated to preventing",
    feedUrl: "https://mercyforanimals.org/feed",
    feedSiteUrl: "https://mercyforanimals.org/blog/",
    sourceKind: "rss",
    itemTitle: "Investigation Reveals Baby Animals Ground Up Alive",
    itemSummary:
      "A Mercy For Animals investigation has exposed how fully conscious, newly hatched chicks are ground up alive by the egg industry. The post Investigation Reveals Baby Animals Ground Up Alive appeared first on Mercy For Animals .",
    itemContentText:
      "A Mercy For Animals investigation has exposed how fully conscious, newly hatched chicks are ground up alive by the egg industry. The footage was captured at a hatchery in Brazil in 2026, but chick culling is not limited to this facility—or to Brazil. Every year, around 7 billion newly hatched chicks are killed worldwide simply because the egg industry does not consider them profitable. The shocking undercover footage offers a rare look inside a system most people never see.",
    itemUrl: "https://mercyforanimals.org/blog/chick-culling-egg-industry-brazil/",
    expected: ["World & Society"],
    needsReview: true,
    note: "Animal welfare investigation; no clean fit, maybe Food",
  },
  {
    id: "stored-07ff836c",
    source: "stored",
    feedTitle: "Defense One - Science & Tech",
    feedDescription: "The discoveries and technology trends that are shaping national security.",
    feedUrl: "https://www.defenseone.com/rss/technology",
    feedSiteUrl: "https://www.defenseone.com/technology/",
    sourceKind: "rss",
    itemTitle: "Can AI help the Marines simplify sustainment in the Pacific?",
    itemSummary: "The service is testing a “logistics decision engine” at the theater level.",
    itemContentText:
      "When a Marine planner is trying to determine whether a deployed unit has everything it needs, they must query several separate databases while cross-referencing supply levels, maintenance records, and more to create a spreadsheet. Marine Corps Forces, Pacific, is hoping an AI-powered logistics platform can make that process much faster and easier. Defense tech company Tagup on Thursday announced a modification to its $2.1 million Small Business Innovation Research contract",
    itemUrl:
      "https://www.defenseone.com/technology/2026/08/can-ai-help-marines-simplify-sustainment-pacific/415709/",
    expected: ["AI & ML"],
  },
  {
    id: "stored-09d93f79",
    source: "stored",
    feedTitle: "The Bulletin",
    feedDescription: "The Bulletin | Central Oregon News, Sports & Community in Bend, OR",
    feedUrl: "https://bendbulletin.com/feed",
    feedSiteUrl: "https://bendbulletin.com/",
    sourceKind: "rss",
    itemTitle: "Guest column: Targeted grazing is not a good answer for wildfire",
    itemSummary:
      "The commentary, “Let livestock clear hard-to-reach grasses before the next wildfire,” published in The Bulletin on September 9th and written by Briana Swette and Kelly Hopping, advocates livestock grazing as […]",
    itemContentText:
      "The commentary, “Let livestock clear hard-to-reach grasses before the next wildfire,” published in The Bulletin on September 9th and written by Briana Swette and Kelly Hopping, advocates livestock grazing as a way to reduce wildfire threats to communities. In their piece, they promote “targeted grazing”. The Farm, Food and National Security Act of 2026, which recently passed the House, legislatively endorses livestock grazing as an effective fuel treatment. The legislation",
    itemUrl:
      "https://bendbulletin.com/2026/09/14/guest-column-targeted-grazing-is-not-a-good-answer-for-wildfire/",
    expected: ["Climate & Environment", "Politics & Policy"],
    needsReview: true,
    note: "Wildfire grazing op-ed citing farm bill; Politics secondary uncertain",
  },
  {
    id: "stored-0a21ff4d",
    source: "stored",
    feedTitle: "Ophthalmology24",
    feedDescription:
      "Ophthalmology24 is an informational hub for patients and medical professionals in the ophthalmology field.",
    feedUrl: "https://www.ophthalmology24.com/blog-feed.xml",
    feedSiteUrl: "https://www.ophthalmology24.com/blog",
    sourceKind: "rss",
    itemTitle: "Ophthalmology Observership or Fellowship as Your Next Step?",
    itemSummary:
      "Doing an ophthalmology observership or fellowship? Learn which is better for aspiring young ophthalmologists who want to gain more skills and become better surgeons.",
    itemContentText:
      "Young ophthalmologists often reach a point where the next step is unclear. You finish exams and early rotations and start gravitating toward subspecialties. If you want progress and direction, you get two common paths ahead of you. Doing an ophthalmology observership or fellowship. Both options sound similar, but they serve different goals. In this guide, we explain the differences in detail so you can take the right step to support your growth. Difference Between",
    itemUrl: "https://www.ophthalmology24.com/ophthalmology-observership-or-fellowship",
    expected: ["Education & Work", "Health & Medicine"],
  },
  {
    id: "stored-0a4beaf1",
    source: "stored",
    feedTitle: "The Union Journal",
    feedDescription: "The Union Journal City News",
    feedUrl: "https://www.theunionjournal.com/feed",
    feedSiteUrl: "https://www.theunionjournal.com/",
    sourceKind: "rss",
    itemTitle:
      "PITATA: Revolutionizing Magic Through Technology, Innovation, and Intelligent Design",
    itemSummary:
      "For centuries, magicians have relied on creativity, psychology, and carefully crafted methods to create moments of impossibility. While the fundamentals of magic remain timeless, technology has opened the door to entirely new experiences",
    itemContentText:
      "For centuries, magicians have relied on creativity, psychology, and carefully crafted methods to create moments of impossibility. While the fundamentals of magic remain timeless, technology has opened the door to entirely new experiences that were unimaginable just a decade ago. Few companies have embraced this evolution as successfully as PITATA . Founded by a team of professional magicians, engineers, and software designers, PITATA has quickly established itself as one of",
    itemUrl:
      "https://www.theunionjournal.com/pitata-revolutionizing-magic-through-technology-innovation-and-intelligent-design/",
    expected: ["Technology", "Culture & Media"],
    needsReview: true,
    note: "Promotional piece on magic tech props",
  },
  {
    id: "stored-0ba843d5",
    source: "stored",
    feedTitle: "Eat - Cha Ching Queen",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://chachingqueen.com/category/eat/feed",
    feedSiteUrl: "https://chachingqueen.com/category/eat/",
    sourceKind: "rss",
    itemTitle: "How to Curb Hunger for Easier, Healthier Weight Loss",
    itemSummary:
      "If you’re trying to lose weight, you know how challenging it can be to deal with constant hunger. You’re not alone in this struggle. Many adults find weight management difficult, and controlling your appetite is a crucial part of the",
    itemContentText:
      "Image Credit: DepositPhotos If you’re trying to lose weight, you know how challenging it can be to deal with constant hunger. You’re not alone in this struggle. Many adults find weight management difficult, and controlling your appetite is a crucial part of the process. The good news is that there are natural, effective ways to help you feel fuller and more satisfied, making it easier to stick to your weight loss goals. When you’re on a weight loss journey, you need to",
    itemUrl: "https://chachingqueen.com/natural-ways-to-control-appetite/",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-0c2fc265",
    source: "stored",
    feedTitle: "News",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://moldcell.md/rom/rss",
    feedSiteUrl: "https://moldcell.md/rom/rss",
    sourceKind: "rss",
    itemTitle: "Primești 100 lei bonus la prima ta plată cu Moldcell Visa Card",
    itemSummary: "Limba Română",
    itemContentText: "Limba Română",
    itemUrl: "https://moldcell.md/rom/primesti-100-lei-la-prima-plata",
    expected: ["Finance & Markets"],
    needsReview: true,
    note: "Romanian promo, text empty; finance offer vs none",
  },
  {
    id: "stored-10887dba",
    source: "stored",
    feedTitle: "Tech Blog - RiverSafe",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://riversafe.co.uk/resources/tech-blog/feed",
    feedSiteUrl: "https://riversafe.co.uk/resources/tech-blog/",
    sourceKind: "rss",
    itemTitle: "Nobody Owns the Risk: Why AI Governance Keeps Falling Through the Gap",
    itemSummary:
      "RiverSafe in conversation with Sapna Patel, Technology and Cyber Leader, Board Advisor Ask a CISO who owns AI risk in their organisation and you will often get a complicated answer, or a silence that says more than any answer could. Sapna",
    itemContentText:
      "RiverSafe in conversation with Sapna Patel, Technology and Cyber Leader, Board Advisor Ask a CISO who owns AI risk in their organisation and you will often get a complicated answer, or a silence that says more than any answer could. Sapna Patel, technology and cyber leader and board advisor, thinks that ambiguity is one of the most pressing problems in security right now and it is getting worse as adoption accelerates. “It depends on the organisation,” she says, “but I think",
    itemUrl:
      "https://riversafe.co.uk/resources/tech-blog/nobody-owns-the-risk-why-ai-governance-keeps-falling-through-the-gap/",
    expected: ["AI & ML", "Security & Privacy"],
  },
  {
    id: "stored-11d1a451",
    source: "stored",
    feedTitle: "Animal Channeler",
    feedDescription:
      "My mission is to give a voice to as many animals as possible! Our animal friends need to be heard!",
    feedUrl: "https://animalchanneler.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://animalchanneler.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Channeled Messages from Whale Shark for All!",
    itemSummary:
      "As I was preparing (meditating) for last weeks radio interview with Eluv on the Ultrasounds show on WMNF 88.5 FM , I asked what animal had messages for me to share for everyone's highest good. A beautiful Whale Shark appeared, this is what",
    itemContentText:
      "As I was preparing (meditating) for last weeks radio interview with Eluv on the Ultrasounds show on WMNF 88.5 FM , I asked what animal had messages for me to share for everyone's highest good. A beautiful Whale Shark appeared, this is what she said: . Don't be afraid. . We suggest working with sounds for healing, too. . We are here to help you move through emotions smoothly as not to get stuck. . Pay attention to your surroundings and shift what you need to. . Trust your",
    itemUrl:
      "https://animalchanneler.blogspot.com/2023/02/channeled-messages-from-whale-shark-for.html",
    expected: [],
    needsReview: true,
    note: "New-age spiritual channeling; none vs Personal & Essays",
  },
  {
    id: "stored-122df84b",
    source: "stored",
    feedTitle: "Blog - Choir Genius",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.choirgenius.com/blog?format=rss",
    feedSiteUrl: "https://www.choirgenius.com/blog/",
    sourceKind: "rss",
    itemTitle:
      "Smart Repertoire Planning: How to Choose Music That Builds Your Choir and Captivates Your Audience",
    itemSummary:
      "Choosing the right repertoire is one of the most powerful tools you have as a conductor. Whether you're programming for a youth chorus, community choir, or advanced vocal ensemble, your selections influence singer development, audience",
    itemContentText:
      "This post is part of The Conductor’s Toolkit series, a practical guide for choir and chorus leaders who want to grow their ensembles, build community, and lead with confidence. View all posts in the series: Grow Your Choir with Leadership | Leading with Purpose Your music choices shape not just your concert, but your choir’s culture, confidence, and connection to community. Choosing the right repertoire is one of the most powerful tools you have as a conductor. Whether",
    itemUrl: "https://www.choirgenius.com/blog/conductor-toolkit-smart-repertoire-planning",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-12cdcf93",
    source: "stored",
    feedTitle: "Posts on Catnap Games",
    feedDescription: "Recent content in Posts on Catnap Games",
    feedUrl: "https://www.catnapgames.com/posts/index.xml",
    feedSiteUrl: "https://www.catnapgames.com/posts/",
    sourceKind: "rss",
    itemTitle: "Tiny Player for Mac 1.2.12",
    itemSummary:
      "Tiny Player for Mac version 1.2.12 is out now. This update brings the following improvements: Press ⌘C to copy playlist (or selection) as text Right click title/subtitle to copy info about current track Organize menu items",
    itemContentText:
      "Tiny Player for Mac version 1.2.12 is out now. This update brings the following improvements: Press ⌘C to copy playlist (or selection) as text Right click title/subtitle to copy info about current track Organize menu items",
    itemUrl: "https://www.catnapgames.com/2020/05/16/tiny-player-for-mac-1-2-12/",
    expected: ["Technology"],
  },
  {
    id: "stored-131f6fec",
    source: "stored",
    feedTitle: "The Scholar's Stage",
    feedDescription:
      "Researching the Communist Party of China is my day job. Here I write long reads on international politics, ancient history, and American conservatism.",
    feedUrl: "https://scholarstage.substack.com/feed",
    feedSiteUrl: "https://scholarstage.substack.com/",
    sourceKind: "rss",
    itemTitle: "Science Proceeds One Question At a Time",
    itemSummary: "Lessons From the History of Biology",
    itemContentText:
      "MIDWAY through his 900 page history of biology , zoologist Ernst Mayr considers the problem posed by Alfred Wallace . Wallace was a contemporary of Charles Darwin who independently developed a theory of speciation by means of natural selection. By the time Wallace came on the scene Darwin had been sitting on his evolutionary theory for two decades. Reading Wallace’s 1858 paper “ On the Tendency of Species to Form Varieties ” spooked Darwin. He did not want to be scooped.",
    itemUrl: "https://scholarstage.substack.com/p/science-proceeds-one-question-at",
    expected: ["Science & Research"],
  },
  {
    id: "stored-13271091",
    source: "stored",
    feedTitle: "CRUSH The Financial Analyst Exam",
    feedDescription: "Pass the CFA Exam on your first try!",
    feedUrl: "https://crushthefinancialanalystexam.com/feed",
    feedSiteUrl: "https://crushthefinancialanalystexam.com/feed/",
    sourceKind: "rss",
    itemTitle: "Analyst Prep Promo Codes (CFA & FRM Discounts)",
    itemSummary:
      "Are you preparing for CFA I, CFA II, or CFA III exams? Analyst Prep’s highly-ranked CFA test prep platform may be just what you need to ensure that you pass with flying colors. The same is true for those studying for an FRM exam. FRM part",
    itemContentText:
      "Are you preparing for CFA I, CFA II, or CFA III exams? Analyst Prep’s highly-ranked CFA test prep platform may be just what you need to ensure that you pass with flying colors. The same is true for those studying for an FRM exam. FRM part I and FRM part II study programs are offered […] The post Analyst Prep Promo Codes (CFA & FRM Discounts) appeared first on CRUSH The Financial Analyst Exam .",
    itemUrl: "https://crushthefinancialanalystexam.com/analyst-prep-promo-codes/",
    expected: ["Education & Work"],
    needsReview: true,
    note: "Promo-code post for exam prep; could be none",
  },
  {
    id: "stored-137ea943",
    source: "stored",
    feedTitle: "SNOW Magazine",
    feedDescription: "Ski Wear, Ski Resorts, Ski Gear, Heli-Skiing",
    feedUrl: "https://thesnowmag.com/feed",
    feedSiteUrl: "https://thesnowmag.com/",
    sourceKind: "rss",
    itemTitle: "Above It All",
    itemSummary: null,
    itemContentText:
      "Long before arrival, the stage is artfully set and, at the top of a fairytale-worthy corkscrew road eleven miles above Brixen, dramatic glamour hangs in the pine-scented air. Succession meets White Lotus, with a South Tyrolean flutter of Eyes Wide Shut to keep things interesting. At once monastery and pleasure dome, Forestis is a study in contradictions – detox and decadence ladled out in equal measure. At the entrance, the house Tesla X glides to a silent stop, its",
    itemUrl: "https://thesnowmag.com/above-it-all/",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-13ce1f33",
    source: "stored",
    feedTitle: "Easypromos Blog: digital engagement strategies and examples for brands",
    feedDescription:
      "Easypromos Blog: how to create interactive promotions and digital engagement experiences",
    feedUrl: "https://www.easypromosapp.com/blog/en/feed",
    feedSiteUrl: "https://www.easypromosapp.com/blog/en/",
    sourceKind: "rss",
    itemTitle: "Instagram Giveaway Platform: Why Brands and Agencies Choose Easypromos",
    itemSummary:
      "Choosing an Instagram giveaway platform is about much more than selecting a random winner. Professional campaigns require official Meta integrations, transparent winner selection, legal compliance, scalable participant management, and",
    itemContentText:
      "Easypromos is a digital engagement platform that helps organizations manage the complete lifecycle of Instagram giveaways—from importing participants through the official Meta APIs to selecting winners with a GLI-19 certified random draw system, publishing verifiable results, and managing prize fulfillment. Whether you’re running a single Instagram giveaway or managing campaigns for multiple brands and clients, Easypromos combines enterprise-grade security, operational",
    itemUrl:
      "https://www.easypromosapp.com/blog/en/instagram-giveaway-platform-for-brands-and-agencies/",
    expected: ["Business & Startups"],
    needsReview: true,
    note: "Promotional marketing platform pitch; Business vs Technology",
  },
  {
    id: "stored-148c616b",
    source: "stored",
    feedTitle: "EXCESS COPYRIGHT",
    feedDescription:
      "Intellectual property law is good. Excess in intellectual property law is not. This blog is about excess in IP and related law. I have practiced law with prestigious firms and successfully acted for",
    feedUrl: "http://excesscopyright.blogspot.com/feeds/posts/default",
    feedSiteUrl: "http://www.blogger.com/feeds/20803105/posts/default",
    sourceKind: "rss",
    itemTitle: "Budget Trepidation for the Nation? Are We Flailing or Even Failing on AI?",
    itemSummary:
      "HAL - 2001 As I wait in trepidation for the November 4, 2025 Federal Budget, I wonder what it will say about AI – the inevitable topic “du jour”. The copyright cabal, or at least two of its least credible but most whiny and vocal members,",
    itemContentText:
      "HAL - 2001 As I wait in trepidation for the November 4, 2025 Federal Budget, I wonder what it will say about AI – the inevitable topic “du jour”. The copyright cabal, or at least two of its least credible but most whiny and vocal members, have made it clear that they want the Government to: … amend the Copyright Act to clarify fair dealing for education, make tariffs set by the Copyright Board of Canada mandatory and enforceable, and ensure statutory damages are available to",
    itemUrl: "http://www.blogger.com/feeds/20803105/posts/default/4201170691733430457",
    expected: ["AI & ML", "Politics & Policy"],
    needsReview: true,
    note: "AI copyright policy; AI vs Politics primary ambiguous",
  },
  {
    id: "stored-151eede0",
    source: "stored",
    feedTitle: "SD Times",
    feedDescription: "Software Development News",
    feedUrl: "https://sdtimes.com/feed",
    feedSiteUrl: "https://sdtimes.com/",
    sourceKind: "rss",
    itemTitle: "Rethinking Application Updates: Solutions for Faster, More Efficient CVE Patching",
    itemSummary:
      "It’s one thing to know about CVEs that affect your business’s applications. It’s quite another, however, to go about fixing CVEs quickly, particularly in cases where a CVE impacts a third-party dependency that multiple applications use.",
    itemContentText:
      "It’s one thing to know about CVEs that affect your business’s applications. It’s quite another, however, to go about fixing CVEs quickly, particularly in cases where a CVE impacts a third-party dependency that multiple applications use. The reason why is that the conventional approach to deploying CVE fixes is to patch each application or container image layer one-by-one. This takes time not only because installing patches can be time-consuming, but also because applications",
    itemUrl:
      "https://sdtimes.com/security/rethinking-application-updates-solutions-for-faster-more-efficient-cve-patching/",
    expected: ["Security & Privacy", "Software Engineering"],
  },
  {
    id: "stored-15cad820",
    source: "stored",
    feedTitle: "The Culbin Trail",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "http://ijparnham.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://ijparnham.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "The bad... redux",
    itemSummary:
      "I guess I should apologize to the makers of Safe House. Last week I droned on about how this was the worst thing I’d seen on TV in 2017. With only 10 days left in the year I doubted it was possible for anything worse to come along. Then",
    itemContentText:
      "I guess I should apologize to the makers of Safe House. Last week I droned on about how this was the worst thing I’d seen on TV in 2017. With only 10 days left in the year I doubted it was possible for anything worse to come along. Then along came Bancroft. With a stellar cast of Sarah Parish, Kenneth Cranham, Art Malik and, er, Ade Edmonson it sounded like a good drama, but it started off badly, went downhill fast and ended in the gutter. Somehow it managed to take all the",
    itemUrl: "http://ijparnham.blogspot.com/2017/12/the-bad-redux.html",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-169c2240",
    source: "stored",
    feedTitle: "PodCacher",
    feedDescription:
      "A world famous site packed with geocaching goodness. Find a podcast, articles, videos and more about high-tech treasure hunting.",
    feedUrl: "https://www.podcacher.com/feed",
    feedSiteUrl: "https://www.podcacher.com/",
    sourceKind: "rss",
    itemTitle: "Show 937.0: Update from Tentmantent about PinPoint",
    itemSummary:
      "On our geocaching podcast today, we have a long-distance chat with Tentmantent about PinPoint, the UK geocaching magazine. We also share an article about a type of puzzle that many geocache creators like, the fourth installment of Tales",
    itemContentText:
      "On our geocaching podcast today, we have a long-distance chat with Tentmantent about PinPoint, the UK geocaching magazine. We also share an article about a type of puzzle that many geocache creators like, the fourth installment of Tales From The Campfire, feedback on pronunciation and much more. Listen To The Show (34:32) Show Discussion: Please chat about the show by commenting on this post below. Show Images: Go to the Flickr set for the show Links mentioned in the show",
    itemUrl: "https://www.podcacher.com/show-937-0-update-from-tentmantent-about-pinpoint/",
    expected: [],
    needsReview: true,
    note: "Geocaching hobby podcast; none vs Sports/Travel",
  },
  {
    id: "stored-16ae8bd3",
    source: "stored",
    feedTitle: "Irish Space Blog",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "http://irishspaceblog.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://irishspaceblog.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "From the Halls of West Point to the International Space Station",
    itemSummary:
      "The United States Military Academy at West Point, New York is well known for producing some of the most highly skilled military graduates in the world. However, it is also renowned for its spacefaring alumni which includes NASA astronaut",
    itemContentText:
      "The United States Military Academy at West Point, New York is well known for producing some of the most highly skilled military graduates in the world. However, it is also renowned for its spacefaring alumni which includes NASA astronaut Tim Kopra, who today launched aboard a Soyuz rocket from the Baikonur Cosmodrome in Kazakhstan for a six month long mission to the International Space Station. Kopra graduated from West Point in 1985 credit: NASA Kopra blasted off at 11:03",
    itemUrl: "http://irishspaceblog.blogspot.com/2015/11/from-halls-of-west-point-to.html",
    expected: ["Science & Research"],
  },
  {
    id: "stored-173f8ea3",
    source: "stored",
    feedTitle: "Hecktic Travels",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.hecktictravels.com/feed",
    feedSiteUrl: "https://www.hecktictravels.com/",
    sourceKind: "rss",
    itemTitle: "Our Return to Thunder Bay: A 2-Day Guide to Exploring This Northern Ontario City",
    itemSummary: "After visiting a few years ago, we knew we had to return. And finally, we did!",
    itemContentText:
      "After visiting a few years ago, we knew we had to return. And finally, we did!",
    itemUrl: "https://www.hecktictravels.com/two-day-trip-to-thunder-bay-ontario/",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-174254d5",
    source: "stored",
    feedTitle: "Invoice Factoring – altLINE",
    feedDescription: "Invoice Factoring, Accounts Receivable Financing, and Asset-Based Lending",
    feedUrl: "https://altline.sobanco.com/category/invoice-factoring/feed",
    feedSiteUrl: "https://altline.sobanco.com/",
    sourceKind: "rss",
    itemTitle: "What is Debt Factoring?",
    itemSummary:
      "Running a business often comes down to timing more than anything else. You can have strong sales on paper yet still feel cash flow pressure simply because customers are slow to pay. This cash flow pressure can wreak havoc on business",
    itemContentText:
      "Running a business often comes down to timing more than anything else. You can have strong sales on paper yet still feel cash flow pressure simply because customers are slow to pay. This cash flow pressure can wreak havoc on business owners who are not prepared, and it’s a common challenge. The Federal Reserve’s 2026 […] The post What is Debt Factoring? appeared first on altLINE .",
    itemUrl: "https://altline.sobanco.com/what-is-debt-factoring/",
    expected: ["Finance & Markets"],
    needsReview: true,
    note: "Business financing; Finance vs Business ambiguous",
  },
  {
    id: "stored-1811ded8",
    source: "stored",
    feedTitle: "TechCentral",
    feedDescription: "Technology News Leader In South Africa",
    feedUrl: "https://techcentral.co.za/feed",
    feedSiteUrl: "https://techcentral.co.za/",
    sourceKind: "rss",
    itemTitle: "Your AI agent is a privileged user. Treat it like one",
    itemSummary:
      "Prompt injection only matters if the agent already holds credentials and enterprise access, writes Simone Santana.",
    itemContentText:
      "The author, AlgoSec’s Simone Santana AI models and autonomous agents have moved out of isolated experiments and into the core of enterprise operations. They are being connected to databases, business applications, cloud platforms, internal application programming interfaces (APIs), software development environments and third-party services. That creates real business value. It also creates a security problem: what happens when an AI system has access to more of the",
    itemUrl: "https://techcentral.co.za/ai-agent-security-privileged-user/286092/",
    expected: ["Security & Privacy", "AI & ML"],
  },
  {
    id: "stored-1832e42d",
    source: "stored",
    feedTitle: "Shipping Blog – FlagShip Courier Solutions",
    feedDescription:
      "Discount & Small Business Shipping | Toronto, Montreal | FlagShip Courier Solutions",
    feedUrl: "https://www.flagshipcompany.com/blog/feed",
    feedSiteUrl: "https://www.flagshipcompany.com/",
    sourceKind: "rss",
    itemTitle: "Sustainable Shipping Solutions: What Every Business Needs to Know in 2026",
    itemSummary:
      'This article was first published on FlagShip Courier Solutions ">FlagShip Courier Solutions . In 2026, sustainability is essential. FlagShip helps Canadian businesses adopt sustainable shipping practices, including paperless processes,',
    itemContentText:
      'This article was first published on FlagShip Courier Solutions ">FlagShip Courier Solutions. As we step further into 2026, sustainability is no longer an option, it is a necessity to find ways to be more environmentally conscious. Every little enhancement matters . Customers expect businesses to take meaningful action toward reducing environmental impact, and sustainable shipping solutions are a critical area where these efforts can shine. For Canadian small and medium-sized',
    itemUrl: "https://www.flagshipcompany.com/blog/shipping-tips/sustainable-shipping/",
    expected: ["Business & Startups", "Climate & Environment"],
    needsReview: true,
    note: "Courier marketing on sustainability; business vs environment",
  },
  {
    id: "stored-1aed2dc7",
    source: "stored",
    feedTitle: "Diego Torres Milano's blog",
    feedDescription: "I hope I can find a good description for this blog...",
    feedUrl: "https://feeds.feedburner.com/DiegoTorresMilanosBlog",
    feedSiteUrl: "http://dtmilano.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Detecting memory leaks on Android apps",
    itemSummary:
      "More often than it should you find yourself wondering if your application is leaking memory and if so what, where and how. A lot of questions that usually don't have enough answers. There are many well know ways your application can leak",
    itemContentText:
      "More often than it should you find yourself wondering if your application is leaking memory and if so what, where and how. A lot of questions that usually don't have enough answers. There are many well know ways your application can leak memory. To name a few static references to Contexts, Views or Activities inner classes holding a reference to the outer class anonymous classes, commonly used in listeners drawables holding a reference to the Context and many more cases If",
    itemUrl: "http://dtmilano.blogspot.com/2017/03/detecting-memory-leaks-on-android-apps.html",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-1bb68aa3",
    source: "stored",
    feedTitle: "Drunky Drunk Girl",
    feedDescription: "A blog about getting sober",
    feedUrl: "https://drunkydrunkgirl.com/feed",
    feedSiteUrl: "https://drunkydrunkgirl.com/",
    sourceKind: "rss",
    itemTitle: "It’s been a busy 2024 so far",
    itemSummary:
      "2:46 pm Just popping on here really quick to say hi, to say that I see you and I hear you, to say that I am still here and still wanting to be engaged with my sober community (though, I do know that most of my old “friends” have moved on,",
    itemContentText:
      "2:46 pm Just popping on here really quick to say hi, to say that I see you and I hear you, to say that I am still here and still wanting to be engaged with my sober community (though, I do know that most of my old &#8220;friends&#8221; have moved on, in one way or [&#8230;]",
    itemUrl: "https://drunkydrunkgirl.com/2024/02/19/its-been-a-busy-2024-so-far/",
    expected: ["Personal & Essays"],
  },
  {
    id: "stored-1c70fc58",
    source: "stored",
    feedTitle: "Combinatorial Game Theory",
    feedDescription: "My CGT musings, with an emphasis on the computational complexity of games.",
    feedUrl: "http://combinatorialgametheory.blogspot.com/feeds/posts/default",
    feedSiteUrl: "http://www.blogger.com/feeds/49096384337620230/posts/default",
    sourceKind: "rss",
    itemTitle: "Sprouts2025 Wrap-up",
    itemSummary:
      "Sprouts 2025 was a big one for us! We broke a lot of records: Most talks: 13 Most student talks: 11 Most submitted computer players: 6 (The previous record was 2!) Most participants in the human tournament: 16 Other exciting things that",
    itemContentText:
      "Sprouts 2025 was a big one for us! We broke a lot of records: Most talks: 13 Most student talks: 11 Most submitted computer players: 6 (The previous record was 2!) Most participants in the human tournament: 16 Other exciting things that happened: The computer player tournament was a real competition this year! All six submitted players seemed better than the Gorgons players that came in last year. You can try playing against them ! (I can say that about the Gorgons players",
    itemUrl: "http://www.blogger.com/feeds/49096384337620230/posts/default/3105154750375795101",
    expected: ["Science & Research"],
    needsReview: true,
    note: "Combinatorial game theory conference; math vs games",
  },
  {
    id: "stored-1cab06a2",
    source: "stored",
    feedTitle: "London Culture Blog",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "http://www.londoncultureblog.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://www.londoncultureblog.com/",
    sourceKind: "rss",
    itemTitle: 'Sabor - "Restaurant" Review',
    itemSummary:
      'Michelin Magic en Casa Here at the London Culture Blog, we\'ve really got into the \'restaurant at home\' scene. The latest sample is "Sabor" (to be precise, "Sabor en casa"), the Michelin-starred Heddon Street eatery. We went for the Box,',
    itemContentText:
      'Michelin Magic en Casa Here at the London Culture Blog, we\'ve really got into the \'restaurant at home\' scene. The latest sample is "Sabor" (to be precise, "Sabor en casa"), the Michelin-starred Heddon Street eatery. We went for the Box, which includes a healthy selection of classic tapas dishes. The packaging is very tidy and the instruction booklet is straightforward and easy to follow. We prepared the first 3 dishes to be served together, namely the ham croquetas, the',
    itemUrl: "http://www.londoncultureblog.com/2021/02/sabor-restaurant-review.html",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-1cb2a99c",
    source: "stored",
    feedTitle: "AED",
    feedDescription: "Arts Every Day",
    feedUrl: "https://artseveryday.org/feed",
    feedSiteUrl: "https://artseveryday.org/",
    sourceKind: "rss",
    itemTitle: "Arts + Culture Spotlight: Bash the Trash",
    itemSummary: "The post Arts + Culture Spotlight: Bash the Trash appeared first on AED .",
    itemContentText:
      "Featuring Bash the Trash provides a range of virtual programming focusing on music, science, and culture. You can build musical instruments from reused materials with your students while learning about sustainability; discover the science of sound and vibrations; explore Native storytelling through shadow puppets… and so much more. We’ve been providing educational services or 35+ years – experienced and flexible! Contact us and let’s chat about what you are looking for. Why",
    itemUrl: "https://artseveryday.org/arts-culture-spotlight-bash-the-trash/",
    expected: ["Education & Work", "Culture & Media"],
    needsReview: true,
    note: "School arts/science programming promo",
  },
  {
    id: "stored-1f4d4783",
    source: "stored",
    feedTitle: "Sex Work CEO",
    feedDescription: "Adult creator education and resources for online adult entrepreneurs.",
    feedUrl: "https://www.sexworkceo.com/blog-feed.xml",
    feedSiteUrl: "https://www.sexworkceo.com/swceoblog",
    sourceKind: "rss",
    itemTitle: "OnlyFans referral lawsuit and what lifetime means",
    itemSummary:
      "OnlyFans referral lawsuit alleges a lifetime 5 percent commission was capped and applied backward. Here is what lifetime means across 20 affiliate programs.",
    itemContentText:
      "Blog Post Written By: Melrose Michaels In 2016 OnlyFans told two of its earliest referral partners that their five percent commission was for life. According to a proposed class action filed on August 12, 2026 one of those creators watched a monthly check fall from over $3,300 to forty cents. Nothing has been proven in court and this case could be dismissed or fought for years, so treat the numbers as allegations rather than findings. Most of the coverage handled this as one",
    itemUrl: "https://www.sexworkceo.com/post/onlyfans-referral-lawsuit-lifetime-affiliate",
    expected: ["Business & Startups", "Politics & Policy"],
    needsReview: true,
    note: "Creator affiliate lawsuit; Business vs courts/policy",
  },
  {
    id: "stored-1f7ae9c5",
    source: "stored",
    feedTitle: "Clayton Rice, K.C.",
    feedDescription: "Criminal Lawyer",
    feedUrl: "https://www.claytonrice.com/feed",
    feedSiteUrl: "https://www.claytonrice.com/",
    sourceKind: "rss",
    itemTitle: "Money Cleaner for Crypto Kids Sentenced for Enterprise Crime",
    itemSummary:
      "A young man who laundered $3.5 million for a crime syndicate dubbed the Crypto Kids has been sentenced to 70 months by a federal judge in the United States District Court for the District of Columbia. Investigators said the group... The",
    itemContentText:
      "A young man who laundered $3.5 million for a crime syndicate dubbed the Crypto Kids has been sentenced to 70 months by a federal judge in the United States District Court for the District of Columbia. Investigators said the group formed through online gaming platforms and squandered its loot on an extravagant lifestyle. The U.S. Attorney said the multi-state enterprise scammed more than $263 million in cryptocurrency from investors. 1. Introduction On December 8, 2025, the",
    itemUrl:
      "https://www.claytonrice.com/money-cleaner-for-crypto-kids-sentenced-for-enterprise-crime/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=money-cleaner-for-crypto-kids-sentenced-for-enterprise-crime",
    expected: ["World & Society", "Security & Privacy"],
    needsReview: true,
    note: "Crypto theft laundering sentencing; crime vs security",
  },
  {
    id: "stored-2054a2a5",
    source: "stored",
    feedTitle: "CelloBello",
    feedDescription: "CelloBello – The Ultimate Cello Resource",
    feedUrl: "https://cellobello.org/feed",
    feedSiteUrl: "https://cellobello.org/",
    sourceKind: "rss",
    itemTitle: "Perform Like a Champion: The Power of Acting As If",
    itemSummary:
      "As a musician, you know that success doesn’t come easily. It requires talent, dedication, and hard work. But beyond these qualities lies another crucial factor that can distinguish a mediocre […]",
    itemContentText:
      "As a musician, you know that success doesn’t come easily. It requires talent, dedication, and hard work. But beyond these qualities lies another crucial factor that can distinguish a mediocre performance from a truly outstanding one: mindset. Woman in casual dress gazes into lit mirror reflecting her in a sparkling gown. Warm room tones contrast with cool blue spotlight. The way we think about ourselves and our abilities has a powerful impact on our performance. If we",
    itemUrl:
      "https://cellobello.org/cello-blog/artistic-vision/perform-like-a-champion-the-power-of-acting-as-if/",
    expected: ["Culture & Media"],
    needsReview: true,
    note: "Musician mindset advice; Culture & Media vs Personal & Essays",
  },
  {
    id: "stored-21257714",
    source: "stored",
    feedTitle: "RFI - All the news from France, Europe, Africa and the rest of the world.",
    feedDescription:
      "Follow any political information, cultural, sporting and live streaming on RFI. The latest information, news and events around the world.",
    feedUrl: "https://www.rfi.fr/en/rss",
    feedSiteUrl: "https://www.rfi.fr/en/",
    sourceKind: "rss",
    itemTitle: "As catches dwindle, Congo River fishermen turn to plastic waste",
    itemSummary:
      "On the Congo River, plastic is becoming the catch of the day. Some fishermen around Kinshasa, capital of the Democratic Republic of Congo, can now make more money pulling plastic from the water than catching fish, as declining catches and",
    itemContentText:
      "On the Congo River, plastic is becoming the catch of the day. Some fishermen around Kinshasa, capital of the Democratic Republic of Congo, can now make more money pulling plastic from the water than catching fish, as declining catches and growing waste pollution threaten an artisanal way of life.",
    itemUrl:
      "https://www.rfi.fr/en/africa/20260913-as-fish-catches-dwindle-congo-river-fishermen-turn-to-plastic",
    expected: ["Climate & Environment", "World & Society"],
  },
  {
    id: "stored-216c091d",
    source: "stored",
    feedTitle: "Stories by Rate My Service on Medium",
    feedDescription: "Stories by Rate My Service on Medium",
    feedUrl: "https://medium.com/feed/@ratemyservice",
    feedSiteUrl: "https://medium.com/@ratemyservice?source=rss-e8f71de5f722------2",
    sourceKind: "rss",
    itemTitle: "Personalising webforms",
    itemSummary:
      "Make your customers feel special by personalising their survey experience. You can now embed personalisation tags within the survey builder (similar to interactive SMS surveys ). This requires personalisation data to be included in either",
    itemContentText:
      "Make your customers feel special by personalising their survey experience. You can now embed personalisation tags within the survey builder (similar to interactive SMS surveys ). This requires personalisation data to be included in either the distribution list or sent to us within the API payload . ⚠️Any tags with no corresponding data will be shown as blank. Please contact our team for any assistance or inquiries regarding this update. Personalising webforms was originally",
    itemUrl:
      "https://medium.com/ratemyservice-release-notes/personalising-webforms-42350485b8bf?source=rss-e8f71de5f722------2",
    expected: ["Technology"],
    needsReview: true,
    note: "Survey SaaS feature update; technology vs business",
  },
  {
    id: "stored-21e104cd",
    source: "stored",
    feedTitle: "STEM-Talk",
    feedDescription: "The most interesting people in the world of science and technology",
    feedUrl: "https://www.ihmc.us/stemtalk/feed/podcast",
    feedSiteUrl: "https://www.ihmc.us/stemtalk/",
    sourceKind: "rss",
    itemTitle:
      "Episode 197: Scott Sherr discusses hyperbaric oxygen therapy, methylene blue, and more",
    itemSummary:
      "Today we have Dr. Scott Sherr, an internal medicine physician who specializes in Hyperbaric Oxygen Therapy. Scott is the director of Integrative Hyperbaric Medicine and Heath Optimization at Hyperbaric Medical Solutions. It is a division",
    itemContentText:
      "Today we have Dr. Scott Sherr, an internal medicine physician who specializes in Hyperbaric Oxygen Therapy. Scott is the director of Integrative Hyperbaric Medicine and Heath Optimization at Hyperbaric Medical Solutions. It is a division of Hyperbaric Medical Solutions, an independent, hyperbaric oxygen therapy provider that aims to educate people about the benefits of hyperbaric oxygen therapy via telemedicine consulting. He also is COO of Troscriptions, which provides",
    itemUrl: "https://www.ihmc.us/stemtalk/episode-197/",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-2213ff14",
    source: "stored",
    feedTitle: "MSP Blog & Marketing Resources - Technibble",
    feedDescription: "Helping Computer Technicians Become Computer Business Owners",
    feedUrl: "https://www.technibble.com/blog/feed",
    feedSiteUrl: "https://www.technibble.com/blog/",
    sourceKind: "rss",
    itemTitle: "Why You Need To Start A Managed Services (MSP) Business in 2021",
    itemSummary:
      "In this video I share the benefits of Managed Services over Break/Fix for a Computer Business. Source: Why You Need To Start A Managed Services (MSP) Business in 2021 - Technibble.com",
    itemContentText:
      "In this video I share the benefits of Managed Services over Break/Fix for a Computer Business. Source: Why You Need To Start A Managed Services (MSP) Business in 2021 - Technibble.com",
    itemUrl: "https://www.technibble.com/why-managed-services/",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-2292327b",
    source: "stored",
    feedTitle: "Socialist Health Association Scotland - Blog",
    feedDescription: "Blog",
    feedUrl: "https://www.shascotland.org/1/feed",
    feedSiteUrl: "https://www.shascotland.org/blog",
    sourceKind: "rss",
    itemTitle: "The reform our NHS really needs",
    itemSummary:
      "With NHS reform getting a lot of attention, the Socialist Health Association Scotland has published a discussion paper I drafted that outlines the issues and seeks views on the way ahead. It is vital that those who support the founding",
    itemContentText:
      "With NHS reform getting a lot of attention, the Socialist Health Association Scotland has published a discussion paper I drafted that outlines the issues and seeks views on the way ahead. It is vital that those who support the founding principles of the NHS engage in this debate and don't leave it to those who use 'reform' as a code for the privatisation of healthcare. Nicola Sturgeon’s resignation has reminded everyone that she was the first SNP Health Secretary in 2007,",
    itemUrl: "https://www.shascotland.org/blog/the-reform-our-nhs-really-needs",
    expected: ["Health & Medicine", "Politics & Policy"],
  },
  {
    id: "stored-245a6768",
    source: "stored",
    feedTitle: "Mariner Finance",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://feeds.feedburner.com/MarinerFinance",
    feedSiteUrl: "https://www.marinerfinance.com/",
    sourceKind: "rss",
    itemTitle: "From Tandem Passenger to Skydiver",
    itemSummary:
      "Sally Palermo had always dreamed of becoming a certified solo skydiver, but the cost made it difficult to turn that dream into reality. “Through the training, jumps, certifications, the licensing, the gear, it costs thousands of dollars,”",
    itemContentText:
      "Sally Palermo had always dreamed of becoming a certified solo skydiver, but the cost made it difficult to turn that dream into reality. “Through the training, jumps, certifications, the licensing, the gear, it costs thousands of dollars,” she says. An offer for a personal loan through Mariner Finance had arrived in her mailbox, but she hadn’t acted on it. ~ ~ ~ ~ ~ “One night, I felt this need to do something,” Sally recalls. “And just the thought of skydiving popped into my",
    itemUrl:
      "https://www.marinerfinance.com/blog/personal-loan/customer-story-sally-palermo-skydiving/",
    expected: ["Finance & Markets"],
    needsReview: true,
    note: "Lender marketing story about loan for skydiving",
  },
  {
    id: "stored-25168d6d",
    source: "stored",
    feedTitle: "JMRush Designs",
    feedDescription:
      "These designs and more can be found at Silhouettedesignstore.com and jamieandjenn.com",
    feedUrl: "http://jmrushdesigns.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://jmrushdesigns.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Mom Hawaiian Floral Card",
    itemSummary:
      "Mom Hawaiian Floral Card-JMRush Approximate Size: W 5.5” X H 4.25” This design is compatible with both 8X12 and 12X12 mats. A complete step by step picture tutorial and alternate images can be found on my blog. You can purchase the",
    itemContentText:
      "Mom Hawaiian Floral Card-JMRush Approximate Size: W 5.5” X H 4.25” This design is compatible with both 8X12 and 12X12 mats. A complete step by step picture tutorial and alternate images can be found on my blog. You can purchase the Silhouette design file here: https://www.silhouettedesignstore.com/artists/485222 Cut design pieces. I used double sided card stock and vellum paper for the circular window piece. Flip the card base over and glue the vellum piece to the",
    itemUrl: "http://jmrushdesigns.blogspot.com/2022/04/mom-hawaiian-floral-card.html",
    expected: [],
  },
  {
    id: "stored-268d2ed7",
    source: "stored",
    feedTitle: "Earth911",
    feedDescription: "More Ideas, Less Waste",
    feedUrl: "http://earth911.com/feed",
    feedSiteUrl: "https://earth911.com/",
    sourceKind: "rss",
    itemTitle: "Understanding the Environmental and Community Impact of AI and Data Centers",
    itemSummary:
      "Ask an AI chatbot a simple question, and its answer uses about as much electricity... The post Understanding the Environmental and Community Impact of AI and Data Centers appeared first on Earth911 .",
    itemContentText:
      "Ask an AI chatbot a simple question, and its answer uses about as much electricity as a microwave running for one second. Now give that same AI a big job and let it work on its own. This is called an agent . It plans its own steps, searches the web, tries things, and keeps going until it thinks it is done. One of those jobs can use as much power as running your laptop for almost six hours. Same technology. Very different bill. That difference introduces a new choice with",
    itemUrl:
      "https://earth911.com/business-policy/understanding-the-environmental-and-community-impact-of-ai-and-data-centers/",
    expected: ["Climate & Environment", "AI & ML"],
  },
  {
    id: "stored-2774a82e",
    source: "stored",
    feedTitle: "Culy",
    feedDescription: "Dagelijks genieten",
    feedUrl: "https://www.culy.nl/feed",
    feedSiteUrl: "https://www.culy.nl/",
    sourceKind: "rss",
    itemTitle:
      "Restje pasta of halve courgette over? Deze AI-tool bedenkt er een compleet nieuw gerecht mee",
    itemSummary:
      "Een halve courgette, drie aardappels en dat bakje andijviestamppot waarvan je zondag écht dacht dat je het maandag als lunch zou eten. Restjes bewaren doen we met de beste bedoelingen, maar een paar dagen later belanden ze alsnog opvallend",
    itemContentText:
      "Een halve courgette, drie aardappels en dat bakje andijviestamppot waarvan je zondag écht dacht dat je het maandag als lunch zou eten. Restjes bewaren doen we met de beste bedoelingen, maar een paar dagen later belanden ze alsnog opvallend vaak in de prullenbak. Tijdens de Verspillingsvrije Week komt Bimi daarom met een AI-tool die moet voorkomen dat je voor de derde keer hetzelfde bord eten opwarmt: Leftover Booster. De Bimi Leftover Booster bedenkt op basis van wat er nog",
    itemUrl: "https://www.culy.nl/nieuws/bimi-leftover-booster/",
    expected: ["Food & Travel", "AI & ML"],
    needsReview: true,
    note: "Dutch text; AI recipe tool for leftovers",
  },
  {
    id: "stored-28168451",
    source: "stored",
    feedTitle: "Mystery Lovers' Kitchen",
    feedDescription:
      "Mystery authors blog about food! Join Leslie Budewitz, Lucy Burdette, Valerie V.M. Burns, Peg Cochran, Cleo Coyle, Maddie Day, Vicki Delany, Leslie Karst, Molly MacRae, and Libby Klein for recipes",
    feedUrl: "https://www.mysteryloverskitchen.com/feeds/posts/default",
    feedSiteUrl: "https://www.blogger.com/feeds/4309470395783938361/posts/default",
    sourceKind: "rss",
    itemTitle: "@AUTHOR DARCI HANNAH, NO BAKE SPECIAL K BARS, RECIPE",
    itemSummary:
      "DARCI HANNAH: In honor of the upcoming Labor Day holiday, and my summer release, MURDER AT THE CAMPFIRE COOKOUT, I want to talk a little bit about my all-time favorite cookie bar recipe, the delicious, no-bake, Special K Bar. I make this",
    itemContentText:
      "DARCI HANNAH: In honor of the upcoming Labor Day holiday, and my summer release, MURDER AT THE CAMPFIRE COOKOUT, I want to talk a little bit about my all-time favorite cookie bar recipe, the delicious, no-bake, Special K Bar. I make this recipe a lot and have brought them to more back yard barbecues and kids’ play dates and sports events than I can count, and they are always a bit hit. Then one",
    itemUrl: "https://www.blogger.com/feeds/4309470395783938361/posts/default/384954913843431370",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-2890cedd",
    source: "stored",
    feedTitle: "Torque",
    feedDescription: "All the Word that's fit to Press",
    feedUrl: "http://torquemag.io/feed",
    feedSiteUrl: "https://torquemag.io/",
    sourceKind: "rss",
    itemTitle: "Press This: Can AI Make The Web More Accessible?",
    itemSummary:
      "Can AI make WordPress sites more accessible? In this episode of Press This, we talk with Amber Hinds, CEO of Equalize Digital, about the promises and challenges of using generative AI and LLMs to tackle accessibility issues on the web. For",
    itemContentText:
      "Welcome to Press This, the WordPress community podcast from WMR. Each episode features guests from around the community and discussions of the largest issues facing WordPress developers. The following is a transcription of the original recording . Powered by RedCircle Doc Pop: You’re listening to Press This, a WordPress community podcast on WMR. Each week we spotlight members of the WordPress community. I’m your host, Doc Pop. I support the WordPress community through my",
    itemUrl: "https://torquemag.io/2024/04/press-this-can-ai-make-the-web-more-accessible/",
    expected: ["AI & ML", "Design & UX"],
    needsReview: true,
    note: "AI for web accessibility; AI vs Design vs Software",
  },
  {
    id: "stored-2915ce14",
    source: "stored",
    feedTitle: "Raymond Camden",
    feedDescription:
      "Father, husband, developer relations and web standards expert, and cat demo builder.",
    feedUrl: "https://www.raymondcamden.com/feed.xml",
    feedSiteUrl: "https://www.raymondcamden.com/feed.xml",
    sourceKind: "rss",
    itemTitle: "Links For You (8/23/26)",
    itemSummary:
      "Greetings, programs. Once again, I'm a bit behind on these posts, but I just got back from two weeks of travel and I'm so happy to be home for a while. My last trip was pretty stressful. On the way out, our plane blew a tire (or tires)",
    itemContentText:
      "Greetings, programs. Once again, I'm a bit behind on these posts, but I just got back from two weeks of travel and I'm so happy to be home for a while. My last trip was pretty stressful. On the way out, our plane blew a tire (or tires) which required an emergency landing in Dallas (which is where we were scheduled to stop anyway). Everything ended up fine, but as I said, stressful. Then coming home we were minutes from our destination when the pilot had to turn around due to",
    itemUrl: "https://www.raymondcamden.com/2026/08/23/links-for-you-82326",
    expected: ["Software Engineering"],
    needsReview: true,
    note: "Link roundup with personal travel intro",
  },
  {
    id: "stored-2a820921",
    source: "stored",
    feedTitle: "Technology – Research Snipers",
    feedDescription: "Magazine",
    feedUrl: "https://researchsnipers.com/category/tech/feed",
    feedSiteUrl: "https://researchsnipers.com/category/tech/",
    sourceKind: "rss",
    itemTitle: "Samsung Galaxy S27: Pro and Ultra models get privacy display",
    itemSummary:
      "Research Snipers Samsung wants to offer the so-called privacy display, which was first introduced with the Galaxy... The post Samsung Galaxy S27: Pro and Ultra models get privacy display appeared first on Research Snipers .",
    itemContentText:
      "Research Snipers Samsung wants to offer the so-called privacy display, which was first introduced with the Galaxy... The post Samsung Galaxy S27: Pro and Ultra models get privacy display appeared first on Research Snipers .",
    itemUrl:
      "https://researchsnipers.com/samsung-galaxy-s27-pro-and-ultra-models-get-privacy-display/",
    expected: ["Technology"],
  },
  {
    id: "stored-2ac97160",
    source: "stored",
    feedTitle: "Thurman Design Studio",
    feedDescription: "Full Service Interior Design",
    feedUrl: "https://www.thurmandesignstudio.com/blog-feed.xml",
    feedSiteUrl: "https://www.thurmandesignstudio.com/blog-old",
    sourceKind: "rss",
    itemTitle: "What Does an Interior Designer Do?",
    itemSummary:
      "When it comes to creating a beautiful, functional, and well-balanced home, an interior designer does much more than simply select...",
    itemContentText:
      "When it comes to creating a beautiful, functional, and well-balanced home, an interior designer does much more than simply select...",
    itemUrl: "https://www.thurmandesignstudio.com/post/what-does-an-interior-designer-do",
    expected: ["Design & UX"],
  },
  {
    id: "stored-2b272efb",
    source: "stored",
    feedTitle: "SolarSpirit",
    feedDescription: "Best Solar Services",
    feedUrl: "https://solarspirit.com.au/feed",
    feedSiteUrl: "https://solarspirit.com.au/",
    sourceKind: "rss",
    itemTitle: "Why Summer is the Perfect Time to Install Solar Panels in Your Australian Home",
    itemSummary:
      "Although Australian summers are renowned globally for cricket matches and barbeques, an increasingly concerning issue is the steep rise in bills during these warmer months. Under the blazing Australian summer sun, the question arises: is",
    itemContentText:
      "Although Australian summers are renowned globally for cricket matches and barbeques, an increasingly concerning issue is the steep rise in bills during these warmer months. Under the blazing Australian summer sun, the question arises: is it the ideal time to invest in solar panels? The answer is a resounding yes! Summer in Australia offers the perfect opportunity to harness solar power and equip your home with solar panels. Stay Cool and Save: Why You Must Invest in Solar",
    itemUrl:
      "https://solarspirit.com.au/blog/solar-panels-installation-for-your-australian-home-in-summer/",
    expected: ["Climate & Environment"],
  },
  {
    id: "stored-2b5e77f6",
    source: "stored",
    feedTitle: "Carlseng Designs",
    feedDescription: "Info and tidbits about landscape designing in Central Oregon",
    feedUrl: "http://carlsengdesigns.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://carlsengdesigns.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "2019 Landscape Projects - Bend",
    itemSummary:
      "2019 Landscape Projects - Bend Backyard Make-over During the winter of 2018/2019 a wonderful family contacted me to make-over their backyard, they had an old paver patio that had warped over the years and some lawn. The clients hired me to",
    itemContentText:
      "2019 Landscape Projects - Bend Backyard Make-over During the winter of 2018/2019 a wonderful family contacted me to make-over their backyard, they had an old paver patio that had warped over the years and some lawn. The clients hired me to help them create a more functional, modern backyard with kitchen, fire pit, dining area and water feature. Before: A tired backyard with a warped old paver patio and a not very functional lawn and surrounding beds. After: A modern",
    itemUrl: "http://carlsengdesigns.blogspot.com/2020/01/2019-landscape-projects-bend.html",
    expected: ["Design & UX"],
    needsReview: true,
    note: "Landscape design portfolio; could be none",
  },
  {
    id: "stored-2ca40ec7",
    source: "stored",
    feedTitle: "Hindu University of America",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.hua.edu/feed",
    feedSiteUrl: "https://www.hua.edu/",
    sourceKind: "rss",
    itemTitle: "Marma Chikitsa: The Ancient Ayurvedic Art of Healing Through Vital Energy Points",
    itemSummary:
      "Discover Marma Chikitsa, Ayurveda's ancient therapy of 107 vital energy points. Learn how it supports balance, healing, stress relief, and overall well-being. The post Marma Chikitsa: The Ancient Ayurvedic Art of Healing Through Vital",
    itemContentText:
      "In the modern pursuit of wellness, we often find ourselves navigating a landscape of fragmented solutions: temporary fixes for chronic stress, physical discomfort, and a pervasive sense of disconnect. Yet, within the profound depth of the Vedic tradition lies a sophisticated technology of “conscious evolution” and healing known as Marma Chikitsa . This ancient art does not merely treat the symptoms of the body; it engages with the very blueprints of our vitality. Marma",
    itemUrl:
      "https://www.hua.edu/blog/marma-chikitsa-the-ancient-ayurvedic-art/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=marma-chikitsa-the-ancient-ayurvedic-art",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-2cbf1bcd",
    source: "stored",
    feedTitle: "SitePoint",
    feedDescription:
      "Learn CSS | HTML5 | JavaScript | Wordpress | Tutorials-Web Development | Reference | Books and More",
    feedUrl: "https://www.sitepoint.com/sitepoint.rss",
    feedSiteUrl: "https://www.sitepoint.com/",
    sourceKind: "rss",
    itemTitle: "Domain Checks Developers Should Make Before Launching a New Web Project",
    itemSummary:
      "null Continue reading Domain Checks Developers Should Make Before Launching a New Web Project on SitePoint .",
    itemContentText:
      "null Continue reading Domain Checks Developers Should Make Before Launching a New Web Project on SitePoint .",
    itemUrl:
      "https://www.sitepoint.com/domain-checks-developers-should-make-before-launching-a-new-web-project/?utm_source=rss",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-2f0ef446",
    source: "stored",
    feedTitle: "TalentLMS Blog",
    feedDescription:
      "Top eLearning blog by TalentLMS with articles about Instructional Design and Development, Online Courses, Gamification, Tin Can API, SCORM, mLearning",
    feedUrl: "https://www.talentlms.com/blog/feed",
    feedSiteUrl: "https://www.talentlms.com/blog/",
    sourceKind: "rss",
    itemTitle: "Top 7 Easy to Use LMS for 2026",
    itemSummary:
      "Choosing a learning management system shouldn’t feel like a second job. But for plenty of teams, that’s precisely what it becomes. You sign up full of good intentions. Then week one disappears into setup. Week two, you’re deep in an admin",
    itemContentText:
      "Choosing a learning management system shouldn’t feel like a second job. But for plenty of teams, that’s precisely what it becomes. You sign up full of good intentions. Then week one disappears into setup. Week two, you’re deep in an admin dashboard that looks like a cockpit, hunting through LMS tools for the one button that assigns a course. By week three? Your “quick training rollout” you promised has quietly become a project of its own. Including a plan to manage, three",
    itemUrl: "https://www.talentlms.com/blog/easy-to-use-lms/",
    expected: ["Education & Work", "Technology"],
    needsReview: true,
    note: "LMS software roundup; education vs technology",
  },
  {
    id: "stored-309a7019",
    source: "stored",
    feedTitle: "Delaware Way",
    feedDescription: "[email]; twitter.com/nannyfat",
    feedUrl: "http://delawareway.blogspot.com/feeds/posts/default",
    feedSiteUrl: "http://www.blogger.com/feeds/32087412/posts/default",
    sourceKind: "rss",
    itemTitle:
      'Join CLNCC For "What\'s Next For New Castle County?" With Marcus Henry! 7PM WEDNESDAY, October 16th',
    itemSummary:
      "Civic League for New Castle County Meeting Note: Special Wednesday Meeting Time : Wednesday 7:30 PM 16th October Topics: What's Next For New Castle County ? Guests: NCC Executive Candidate Marcus Henry Location: Zoom ~*~",
    itemContentText:
      "Civic League for New Castle County Meeting Note: Special Wednesday Meeting Time : Wednesday 7:30 PM 16th October Topics: What's Next For New Castle County ? Guests: NCC Executive Candidate Marcus Henry Location: Zoom ~*~",
    itemUrl: "http://www.blogger.com/feeds/32087412/posts/default/984127104439066447",
    expected: ["Politics & Policy"],
  },
  {
    id: "stored-31bdd847",
    source: "stored",
    feedTitle: "Ecology Research News -- ScienceDaily",
    feedDescription:
      "Learn about recent research into biodiversity reduction and how it affects ecosystems. Read news articles on coral bleaching, deforestation and wetland ecology.",
    feedUrl: "https://www.sciencedaily.com/rss/earth_climate/ecology.xml",
    feedSiteUrl: "https://www.sciencedaily.com/news/earth_climate/ecology/",
    sourceKind: "rss",
    itemTitle: "Africa’s forests have flipped from carbon sink to carbon source",
    itemSummary:
      "Africa’s forests have undergone a shocking reversal, switching from carbon absorbers to carbon emitters after 2010. Researchers found that heavy deforestation in tropical regions has led to massive biomass losses, far outweighing any gains",
    itemContentText:
      "Africa’s forests have undergone a shocking reversal, switching from carbon absorbers to carbon emitters after 2010. Researchers found that heavy deforestation in tropical regions has led to massive biomass losses, far outweighing any gains from regrowth elsewhere. This change could seriously undermine global efforts to slow climate change. Scientists warn that protecting forests is now more urgent than ever.",
    itemUrl: "https://www.sciencedaily.com/releases/2026/04/260413043135.htm",
    expected: ["Climate & Environment", "Science & Research"],
  },
  {
    id: "stored-328215ad",
    source: "stored",
    feedTitle: "Tech Pilipinas",
    feedDescription:
      "Tech Pilipinas is the Philippines' digital lifestyle blog that focuses on the latest news and updates from the world of technology, computers, electronic gadgets, startups, mobile apps, social media,",
    feedUrl: "https://techpilipinas.com/feed",
    feedSiteUrl: "https://techpilipinas.com/",
    sourceKind: "rss",
    itemTitle: "Marcos pushes waste-to-energy facilities to address garbage crisis",
    itemSummary:
      "President Ferdinand R. Marcos Jr. is pushing waste-to-energy (WTE) facilities as what he called the “only solution” to the country’s garbage problem, a directive that has prompted the Department of Energy (DOE) to accelerate implementation",
    itemContentText:
      "President Ferdinand R. Marcos Jr. is pushing waste-to-energy (WTE) facilities as what he called the “only solution” to the country’s garbage problem, a directive that has prompted the Department of Energy (DOE) to accelerate implementation of its WTE program. Marcos made the statement during an inspection of clearing and waste collection operations at the Diokno […] The post Marcos pushes waste-to-energy facilities to address garbage crisis appeared first on Tech Pilipinas .",
    itemUrl:
      "https://techpilipinas.com/marcos-pushes-waste-energy-facilities-address-garbage-crisis/",
    expected: ["Climate & Environment", "Politics & Policy"],
  },
  {
    id: "stored-3401c03b",
    source: "stored",
    feedTitle: "LA Photo Team",
    feedDescription: "Professional Photo & Video Production",
    feedUrl: "https://www.laphototeam.com/feed",
    feedSiteUrl: "https://www.laphototeam.com/",
    sourceKind: "rss",
    itemTitle: "How Professional Event Photography Brings Long-Term Value to Your Brand",
    itemSummary:
      "Hosting an event is a long process, takes time and money. Everything from corporate conference to product launch, networking mixer to gala, awards ceremony, nonprofit fundraiser to private celebration—everything is planned and done in",
    itemContentText:
      "Hosting an event is a long process, takes time and money. Everything from corporate conference to product launch, networking mixer to gala, awards ceremony, nonprofit fundraiser to private celebration—everything is planned and done in order to make sure it’s an experience you’re sure to remember. What happens after the event is over however, many businesses find that the money they’ve spent on a product in the event only lives on in the memory of your guests. Professional",
    itemUrl: "https://www.laphototeam.com/professional-event-photography-long-term-brand-value/",
    expected: ["Business & Startups"],
    needsReview: true,
    note: "Photography vendor marketing piece",
  },
  {
    id: "stored-3403303a",
    source: "stored",
    feedTitle: "Ships Machinery – MARINE ENGINEERING AT A GLANCE",
    feedDescription: "MARINE ENGINEERING AT A GLANCE",
    feedUrl: "https://marinediesel.co.in/ships-machinery/feed",
    feedSiteUrl: "https://marinediesel.co.in/",
    sourceKind: "rss",
    itemTitle: "How to Become a Naval Architect: 2026 Scope & Jobs",
    itemSummary:
      "For centuries, humanity has been drawn to the water. That pull—the freedom, the adventure, the tranquility—is often crystallized in a ... Read more",
    itemContentText:
      "For centuries, humanity has been drawn to the water. That pull—the freedom, the adventure, the tranquility—is often crystallized in a ... Read more",
    itemUrl: "https://marinediesel.co.in/naval-architect/",
    expected: ["Education & Work"],
    needsReview: true,
    note: "Thin text; careers guide for naval architects",
  },
  {
    id: "stored-35c0e1cf",
    source: "stored",
    feedTitle: "Personal Injury San Diego",
    feedDescription: "Your Source for Legal Injury Help",
    feedUrl: "https://www.personalinjurysandiego.org/feed",
    feedSiteUrl: "https://www.personalinjurysandiego.org/",
    sourceKind: "rss",
    itemTitle: "Defective Motorcycle Parts Product Liability California",
    itemSummary:
      "Not every motorcycle accident is caused by another driver’s negligence or a road hazard. Some crashes are caused by defects in the motorcycle itself — brake system failures, tire defects, throttle malfunctions, frame cracks, and a range of",
    itemContentText:
      "Not every motorcycle accident is caused by another driver’s negligence or a road hazard. Some crashes are caused by defects in the motorcycle itself — brake system failures, tire defects, throttle malfunctions, frame cracks, and a range of other component failures that cause the rider to lose control or fail to respond to an emergency. California’s strict products liability doctrine (Greenman v. Yuba Power Products, 1963) holds motorcycle manufacturers, component makers,",
    itemUrl:
      "https://www.personalinjurysandiego.org/practice-areas/defective-motorcycle-parts-product-liability-california/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=defective-motorcycle-parts-product-liability-california",
    expected: ["Politics & Policy"],
    needsReview: true,
    note: "Law-firm marketing on product liability; legal fit weak",
  },
  {
    id: "stored-3622f591",
    source: "stored",
    feedTitle: "Family Travel Blog – Ciao Bambino!",
    feedDescription: "Ciao Bambino!",
    feedUrl: "http://ciaobambino.com/editorial/feed",
    feedSiteUrl: "https://ciaobambino.com/",
    sourceKind: "rss",
    itemTitle:
      "Personal Connections in a Digital World: 2026 Ciao Bambino Travel Planning Testimonials",
    itemSummary:
      "Each year our client testimonials tell us something about what matters most to traveling families, and this year the message came through loud and clear. We are loving that clients of all ages and stages... The post Personal Connections in",
    itemContentText:
      "Each year our client testimonials tell us something about what matters most to traveling families, and this year the message came through loud and clear. We are loving that clients of all ages and stages continue to prioritize meaningful experiences over the accumulation of material possessions. And likewise, the more our clients are enveloped in technology in every aspect of daily life, the more they appreciate the human connections we foster through the trip planning",
    itemUrl: "https://ciaobambino.com/2026-testimonials",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-36826955",
    source: "stored",
    feedTitle: "A Photo Editor",
    feedDescription: "Former Photography Director Rob Haggart",
    feedUrl: "https://www.aphotoeditor.com/feed",
    feedSiteUrl: "https://www.aphotoeditor.com/",
    sourceKind: "rss",
    itemTitle: "Pricing & Negotiating: Photographer Loses $259k Photoshoot to AI",
    itemSummary:
      "By Bryan Sheffield, Wonderful Machine Each month, we analyze a recent cost estimate, contract, or purchase order and present it in the form of a Pricing & Negotiating article. Redacting the names of the photographer and client allows us to",
    itemContentText:
      "By Bryan Sheffield, Wonderful Machine Each month, we analyze a recent cost estimate, contract, or purchase order and present it in the form of a Pricing & Negotiating article. Redacting the names of the photographer and client allows us to share useful information that would otherwise be confidential. You can learn more about how we can help you with Pricing & Negotiating on the Consulting Services page of our website. Concept: Still-life and lifestyle photography of talent",
    itemUrl:
      "https://www.aphotoeditor.com/2026/07/16/pricing-negotiating-photographer-loses-259k-photoshoot-to-ai/",
    expected: ["Business & Startups"],
    needsReview: true,
    note: "Photography pricing/business; AI angle mostly in title",
  },
  {
    id: "stored-3684e83b",
    source: "stored",
    feedTitle: "Blockchain Research Lab",
    feedDescription: "Non-profit research institution",
    feedUrl: "https://www.blockchainresearchlab.org/feed",
    feedSiteUrl: "https://www.blockchainresearchlab.org/",
    sourceKind: "rss",
    itemTitle:
      "How the rising popularity of cryptocurrency influences gambling addiction treatment and prevention: An in-person workshop in Zurich, Switzerland",
    itemSummary:
      "Dr. Steinmetz had the opportunity to contribute to a full-day seminar in Zurich on a topic that has become increasingly urgent in the context of gambling addiction: the entanglements between cryptocurrency, blockchain technology, and",
    itemContentText:
      "How the rising popularity of cryptocurrency influences gambling addiction treatment and prevention: An in-person workshop in Zurich, Switzerland In November 2024, Dr. Steinmetz had the opportunity to contribute to a full-day seminar in Zurich on a topic that has become increasingly urgent in the context of gambling addiction: the entanglements between cryptocurrency, blockchain technology, and gambling. The event was organized by the Ostschweizer Fachhochschule, specifically",
    itemUrl:
      "https://www.blockchainresearchlab.org/2025/01/16/how-the-rising-popularity-of-cryptocurrency-influences-gambling-addiction-treatment-and-prevention-an-in-person-workshop-in-zurich-switzerland/",
    expected: ["Health & Medicine", "Finance & Markets"],
    needsReview: true,
    note: "Gambling addiction and crypto workshop; Health vs Finance",
  },
  {
    id: "stored-36af540e",
    source: "stored",
    feedTitle: "National Herald",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://prod-qt-images.s3.amazonaws.com/production/nationalherald/feed.xml",
    feedSiteUrl: "https://www.nationalheraldindia.com/",
    sourceKind: "rss",
    itemTitle: "Trump EPA poised to repeal carbon pollution rules for power plants",
    itemSummary: "Move to roll back Biden-era standards could face legal challenges",
    itemContentText: "Move to roll back Biden-era standards could face legal challenges",
    itemUrl:
      "https://www.nationalheraldindia.com/environment/trump-epa-poised-to-repeal-carbon-pollution-rules-for-power-plants",
    expected: ["Politics & Policy", "Climate & Environment"],
  },
  {
    id: "stored-36afca45",
    source: "stored",
    feedTitle: "Drury Design Blog",
    feedDescription:
      "Drury Design is an award-winning remodeling firm specializing in custom kitchens and baths in the Chicago area. Their talented professional designers create exceptionally personalized spaces for you.",
    feedUrl: "https://www.drurydesigns.com/feed",
    feedSiteUrl: "https://www.drurydesigns.com/blog/",
    sourceKind: "rss",
    itemTitle:
      "Gladys Schanstra’s “Two Kitchens, One Home” Project Named Finalist for Sub-Zero/Wolf/Cove Kitchen Design Contest",
    itemSummary:
      "The post Gladys Schanstra’s “Two Kitchens, One Home” Project Named Finalist for Sub-Zero/Wolf/Cove Kitchen Design Contest appeared first on Drury Design .",
    itemContentText:
      "Back to Blog Gladys Schanstra’s “Two Kitchens, One Home” Project Named Finalist in Sub-Zero/Wolf/Cove Kitchen Design Contest It takes a truly special kitchen to capture the attention of a global panel of elite design experts. That’s why we’re absolutely thrilled to announce that Drury Design owner and Creative Director Gladys Schanstra has been named a finalist in the prestigious Sub-Zero, Wolf, and Cove Kitchen Design Contest! A Competition on the World Stage The Sub-Zero,",
    itemUrl: "https://www.drurydesigns.com/gladys-schanstra-wolf-sub-zero-cove-contest-finalist/",
    expected: ["Design & UX"],
  },
  {
    id: "stored-372a15ac",
    source: "stored",
    feedTitle: "The Leader – The No. 1 Spanish Newspaper",
    feedDescription:
      "Spain News, Sport, Spanish Property for Sale, Business Directory, Classifieds, and Advertising",
    feedUrl: "https://theleader.info/feed",
    feedSiteUrl: "https://theleader.info/",
    sourceKind: "rss",
    itemTitle: "Two-Hour Parking Limit Introduced on Ramón Gallud",
    itemSummary:
      "Parking on Calle Ramón Gallud in central Torrevieja will be limited to a maximum of two hours during working days from Tuesday, September 15. The restriction will apply between 8am and 8pm, while parking outside those hours will remain",
    itemContentText:
      "Parking on Calle Ramón Gallud in central Torrevieja will be limited to a maximum of two hours during working days from Tuesday, September 15. The restriction will apply between 8am and 8pm, while parking outside those hours will remain unrestricted. The two-hour limit will not apply on non-working days. Local Police councillor Federico Alarcón said the measure was intended to increase the turnover of vehicles along one of the city centre’s main shopping and service streets.",
    itemUrl: "https://theleader.info/2026/09/15/two-hour-parking-limit-introduced-on-ramon-gallud/",
    expected: ["Politics & Policy", "World & Society"],
    needsReview: true,
    note: "Local council parking rule; Politics vs local news",
  },
  {
    id: "stored-38ed4270",
    source: "stored",
    feedTitle: "A Java geek",
    feedDescription: "Nicolas Fränkel's blog",
    feedUrl: "https://blog.frankel.ch/feed.xml",
    feedSiteUrl: "https://blog.frankel.ch/",
    sourceKind: "rss",
    itemTitle: "Security Baked Into the JVM: the Safe Codebase Audit Pipeline",
    itemSummary:
      "In Part 1, the minimal deployment showed constraints traveling with the proxy: authentication, encryption, hardened deserialization, all declared in configuration and enforced at the call boundary. The proxy is a JAR. That JAR was",
    itemContentText:
      "In Part 1, the minimal deployment showed constraints traveling with the proxy: authentication, encryption, hardened deserialization, all declared in configuration and enforced at the call boundary. The proxy is a JAR. That JAR was downloaded and unmarshalled before any constraint ran. That step is the earlier problem. Distributed Java systems that load remote code are vulnerable to supply chain compromise: an attacker can replace a legitimate JAR with one containing",
    itemUrl: "https://blog.frankel.ch/security-baked-into-jvm/2/",
    expected: ["Software Engineering", "Security & Privacy"],
  },
  {
    id: "stored-3b4605f7",
    source: "stored",
    feedTitle: "SteadyOptions Trading Blog",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://steadyoptions.com/articles?rss=1/feed",
    feedSiteUrl: "https://steadyoptions.com/articles/",
    sourceKind: "rss",
    itemTitle: "OptionNET Explorer (ONE) - Options Backtesting Software",
    itemSummary:
      "The software provides traders with two key functions: The ability to design, backtest, and monitor strategies using free historical data. The ability to connect to select brokers and push through live trades so that you can monitor their",
    itemContentText:
      "The software provides traders with two key functions: The ability to design, backtest, and monitor strategies using free historical data. The ability to connect to select brokers and push through live trades so that you can monitor their performance in Option Net Explorer. It is great for backtesting and perfecting options trading strategies. It was made with the vision of allowing regular traders to have access to tools that professional traders demand. SteadyOptions",
    itemUrl:
      "https://steadyoptions.com/articles/optionnet-explorer-one-options-backtesting-software-r743/",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-3ba8a561",
    source: "stored",
    feedTitle: "Crypto Insiders",
    feedDescription: "#1 in Bitcoin en altcoin",
    feedUrl: "https://www.crypto-insiders.nl/feed",
    feedSiteUrl: "https://www.crypto-insiders.nl/",
    sourceKind: "rss",
    itemTitle: "Bitmine koopt weer 27.180 Ethereum bij: ‘best presterende bezitting’",
    itemSummary:
      "Bitmine breidt zijn ethereum-voorraad uit naar 5, 96 miljoen munten, terwijl topman Tom Lee ethereum dit kwartaal de best presterende bezitting op de markt noemt.",
    itemContentText:
      "Bitmine blijft onvermoeibaar ethereum bijkopen. Met de nieuwste aankoop komt het bedrijf van topman Tom Lee nog dichter bij zijn langgekoesterde doel van 5 procent van alle ethereum, dat volgens hem dit kwartaal de best presterende bezitting op de bredere markt is. Tip: Ontvang het belangrijkste cryptonieuws als eerste via de gratis Crypto Insiders app. In het kort: Bitmine kocht de afgelopen week 27.180 ethereum bij, en bezit nu 5.956.378 ethereum, al 98 procent op weg naar",
    itemUrl:
      "https://www.crypto-insiders.nl/nieuws/ethereum/bitmine-koopt-weer-27-180-ethereum-bij-best-presterende-bezitting/",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-3c957669",
    source: "stored",
    feedTitle: "IndieFilmProfessor | Film Professor, MBA | MFA",
    feedDescription:
      "IndieFilmWorks is a creative hub where filmmakers learn, experiment, and grow together through tools, training, and community-driven collaboration.",
    feedUrl: "https://www.indiefilmprofessor.com/blog-feed.xml",
    feedSiteUrl: "https://www.indiefilmprofessor.com/blog",
    sourceKind: "rss",
    itemTitle: "Daily Affirmation With Laura Vance",
    itemSummary:
      "Start Your Day with Intention Today is a fresh start, and every small step you take moves you forward. Trust yourself, stay present, and let your light guide the day... Stay golden, my friends. Manifest tomorrow's reality... ✨ I'll meet",
    itemContentText:
      "Start Your Day with Intention Today is a fresh start, and every small step you take moves you forward. Trust yourself, stay present, and let your light guide the day... Stay golden, my friends. Manifest tomorrow's reality... ✨ I'll meet you there. [ ] [ ]",
    itemUrl: "https://www.indiefilmprofessor.com/post/daily-affirmation-with-laura-vance",
    expected: ["Personal & Essays"],
    needsReview: true,
    note: "Daily affirmation post; borderline none",
  },
  {
    id: "stored-3d00fa0c",
    source: "stored",
    feedTitle: "The Skinny Doll",
    feedDescription: "This girl is losing it!",
    feedUrl: "https://www.theskinnydoll.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://www.theskinnydoll.com/",
    sourceKind: "rss",
    itemTitle: "Gold Edition Ketchups!",
    itemSummary:
      "Another great Irish product to shout about... Cali Cali have built their range up of fab products over the last couple of years and now you'll spot their gold edition sauces on the shelves! There's four to choose from and like their crisps",
    itemContentText:
      "Another great Irish product to shout about... Cali Cali have built their range up of fab products over the last couple of years and now you'll spot their gold edition sauces on the shelves! There's four to choose from and like their crisps (there's a blog post on those have a peep in the search bar!) they are full of flavour! Four ketchups, tomato, chipotle, kimchi and smoky BBQ! Anyone tried them out? x Cali Cali, Tomato Ketchup, Gold Edition up to 20g - 0SP up to 55g - 1SP",
    itemUrl: "https://www.theskinnydoll.com/2021/08/gold-edition-ketchups.html",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-3df4e86c",
    source: "stored",
    feedTitle: "The Hermeneutic of Continuity",
    feedDescription:
      "Therefore every scribe who has been trained for the kingdom of heaven is like a householder who brings out of his treasure what is new and what is old.",
    feedUrl: "https://the-hermeneutic-of-continuity.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://the-hermeneutic-of-continuity.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Saint Gabriel",
    itemSummary:
      "The angels call for our veneration and awe as part of God’s creation. Part of the destructive modernism of the 1970s included advice to Catholic school teachers that they should not talk to children about angels. This wrought lasting",
    itemContentText:
      "The angels call for our veneration and awe as part of God’s creation. Part of the destructive modernism of the 1970s included advice to Catholic school teachers that they should not talk to children about angels. This wrought lasting damage which continues to need rectifying. We should include in our prayers a heartfelt recourse to our own Guardian Angels. The Archangel Gabriel “God is my strength” would be terrifying were he to appear to any of us. Our Lady was “troubled”",
    itemUrl: "https://the-hermeneutic-of-continuity.blogspot.com/2023/03/saint-gabriel.html",
    expected: [],
    needsReview: true,
    note: "Catholic devotional post; no religion label fits",
  },
  {
    id: "stored-3f185c83",
    source: "stored",
    feedTitle: "Personal Finance – Blog by Tickertape",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.tickertape.in/blog/personal-finance/feed",
    feedSiteUrl: "https://www.tickertape.in/blog",
    sourceKind: "rss",
    itemTitle: "How To Declare Mutual Funds in ITR & Disclose Capital Gains in India?",
    itemSummary:
      "Learn how mutual funds are taxed and find out how to declare mutual funds while filing ITR. Explore the tax implications on mutual fund gains today!",
    itemContentText:
      "Filing Income Tax Returns (ITR) is your federal duty if you earn an income in the financial year exceeding Rs. 2.5 lakh. When mutual fund tax filing your returns, you have to declare incomes earned from various sources. If you have made specific investments that earn you tax deductions from tax on mutual fund dividends or exemptions, the same should be declared in the ITR. Mutual fund investments also give you tax benefits if you choose the ELSS schemes. Moreover, when you",
    itemUrl: "https://www.tickertape.in/blog/declare-mutual-fund-investment/",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-40967605",
    source: "stored",
    feedTitle: "HackerNoon",
    feedDescription: "How hackers start their afternoons.",
    feedUrl: "https://cdn.hackernoon.com/feed",
    feedSiteUrl: "https://hackernoon.com/",
    sourceKind: "rss",
    itemTitle:
      "Whose Memory Is It? Building Multi-Tenant, Multi-Tier Memory for AI Agents (Part 4)",
    itemSummary:
      "This is a 4-part series on how agents remember:building short-, medium- and long-term memory thatscales across users, agents, and kubernetes clusters.",
    itemContentText:
      "This is a 4-part series on how agents remember:building short-, medium- and long-term memory thatscales across users, agents, and kubernetes clusters. Alice and Bob both use our agent platform. On Monday, Alice worked on a support incident, and the agent remembers what she told it. On Thursday, Bob asks a similar question, and the agent, being helpful, answers with what it learned from Alice. Nothing was hacked, Bob doesn’t know about prompt injection, and nothing about that",
    itemUrl:
      "https://hackernoon.com/whose-memory-is-it-building-multi-tenant-multi-tier-memory-for-ai-agents-part-4?source=rss",
    expected: ["Software Engineering", "AI & ML"],
  },
  {
    id: "stored-41821f47",
    source: "stored",
    feedTitle: "Joanna Anastasia",
    feedDescription: "lifestyle & design with a dash of mindfulness",
    feedUrl: "https://joannaanastasia.com/feed",
    feedSiteUrl: "https://joannaanastasia.com/",
    sourceKind: "rss",
    itemTitle: "Old fashioned pear coffee cake that you should make now",
    itemSummary:
      "Large pear pieces are baked inside a fluffy cake batter covered with crunchy walnuts- this coffee cake is a melt in your mouth fall perfection! The post Old fashioned pear coffee cake that you should make now first appeared on Joanna",
    itemContentText:
      "Large pear pieces are baked inside a fluffy cake batter covered with crunchy walnuts- this coffee cake is a melt in your mouth fall perfection! The post Old fashioned pear coffee cake that you should make now first appeared on Joanna Anastasia . The post Old fashioned pear coffee cake that you should make now appeared first on Joanna Anastasia .",
    itemUrl: "https://joannaanastasia.com/old-fashioned-pear-coffee-cake-that-you-should-make-now/",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-418f6618",
    source: "stored",
    feedTitle: "Radio Times",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.radiotimes.com/feed",
    feedSiteUrl: "https://www.radiotimes.com/",
    sourceKind: "rss",
    itemTitle: "iPhone 18 Pro Max live stock updates: where to pre-order in the UK today",
    itemSummary: "Pre-orders are live for the new flagship iPhone.",
    itemContentText:
      "Apple's newest iPhone range is available for pre-order now, and right now the best availability is at Sky and JD Williams . These new phones bring us vast improvements to the range's camera and battery life, not to mention two sleek new colourways. The iPhone 18 Pro and 18 Pro Max were unveiled at the Apple Event on Thursday alongside the tech giant's most dramatic redesign ever: the folding iPhone Duo. However, while the Duo won't be available until October, the 18 Pro and",
    itemUrl:
      "https://www.radiotimes.com/technology/technology-guides/iphone-18-pro-max-uk-live-stock/",
    expected: ["Technology"],
  },
  {
    id: "stored-41fcd1d0",
    source: "stored",
    feedTitle: "My DFIR Blog",
    feedDescription:
      "Digital Forensics & Incident Response & Reverse Engineering & Vulnerability Research",
    feedUrl: "https://dfir.ru/feed",
    feedSiteUrl: "https://dfir.ru/",
    sourceKind: "rss",
    itemTitle: "Mark-of-the-Web: the rules changed, the tools didn’t",
    itemSummary:
      "There are many CVE IDs assigned for various issues resulting in missing or improper Mark-of-the-Web (MOTW) propagation when extracting files from archives (#1, #2, #3, #4, #5, #6, and so on). Some of these issues are disputed using the",
    itemContentText:
      "There are many CVE IDs assigned for various issues resulting in missing or improper Mark-of-the-Web (MOTW) propagation when extracting files from archives ( #1 , #2 , #3 , #4 , #5 , #6 , and so on). Some of these issues are disputed using the same template (inserted by MITRE): Mark-of-the-Web propagation can increase risk via security-warning habituation – in other words, users are tired of such warnings; the intended control sphere for file-origin metadata (e.g., HostUrl in",
    itemUrl: "https://dfir.ru/2026/06/29/mark-of-the-web-the-rules-changed-the-tools-didnt/",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-42fd2a1f",
    source: "stored",
    feedTitle: "James' Blog",
    feedDescription: "100% Science, 100% Windsurfing, 100% What-have-you",
    feedUrl: "http://jimbodouglass.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://jimbodouglass.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Manatees warming inland, wind addicts shredding in the Gulf",
    itemSummary:
      "The Florida Manatee ( Trichechus manatus latirostris ) is a subspecies of the West Indian Manatee. The other subspecies is the Antillean Manatee, Trichechus manatus manatus . The distinction is that only the Florida Manatee has to deal",
    itemContentText:
      'The Florida Manatee (Trichechus manatus latirostris) is a subspecies of the West Indian Manatee. The other subspecies is the Antillean Manatee, Trichechus manatus manatus. The distinction is that only the Florida Manatee has to deal with cold water in winter. It does so by migrating inland to "warm water refugia" like freshwater springs. The Florida Manatee is also a little bigger than the Antillean Manatee, which might be another cold adaptation. Development in Florida has',
    itemUrl: "http://jimbodouglass.blogspot.com/2026/01/manatees-warming-inland-wind-addicts.html",
    expected: ["Climate & Environment"],
    needsReview: true,
    note: "Personal blog: manatee conservation plus kitesurfing",
  },
  {
    id: "stored-44f6aab1",
    source: "stored",
    feedTitle: "Grand Text Auto",
    feedDescription: "A group blog about computer narrative, games, poetry, and art.",
    feedUrl: "https://grandtextauto.soe.ucsc.edu/feed",
    feedSiteUrl: "https://grandtextauto.soe.ucsc.edu/",
    sourceKind: "rss",
    itemTitle: "Glitch Squad Press Release",
    itemSummary:
      "April 6, 2022 (Hanover, NH) – The latest board game designed at Tiltfactor, Glitch Squad, is being published by Resonym, and coming to Kickstarter on April 19th.",
    itemContentText:
      "For Immediate Release Contact: [email] April 6, 2022 (Hanover, NH) – The latest board game designed at Tiltfactor, Glitch Squad, is being published by Resonym, and coming to Kickstarter on April 19th. Glitch Squad was designed at Dr. Mary Flanagan’s Tiltfactor research lab at Dartmouth College by distinguished designers Mary Flanagan and Max Seidman, and designed in collaboration with LabX at the National Academy of Sciences. Glitch Squad will join the independent publisher",
    itemUrl:
      "https://tiltfactor.org/glitch-squad-press-release/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=glitch-squad-press-release",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-452bfbb3",
    source: "stored",
    feedTitle: "Small Business Tips and Ideas for Women Entrepreneurs | Founding Females®",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://foundingfemalesco.com/blog?format=rss",
    feedSiteUrl: "https://foundingfemalesco.com/blog/",
    sourceKind: "rss",
    itemTitle: "Member Spotlight: Hannah Hernandez, founder of EQBM Design Company",
    itemSummary:
      "Meet Hannah Hernandez, founder of EQBM Design Company, and discover how she's helping entrepreneurs build strategic brands, gain confidence, and create visuals that match their vision. Click to view…",
    itemContentText:
      "Hannah Builds Brands That Finally Match the Vision Some entrepreneurs start businesses because they have a carefully mapped-out plan. Others start because life unexpectedly closes one door and reveals another. For Hannah Hernandez, founder of EQBM Design Company , what began as freelancing after college eventually became a thriving graphic design studio dedicated to helping entrepreneurs build brands that reflect who they truly are and where they're headed. Today, Hannah",
    itemUrl: "https://foundingfemalesco.com/blog/mastermind-hannah-hernandez",
    expected: ["Business & Startups", "Design & UX"],
  },
  {
    id: "stored-4730548b",
    source: "stored",
    feedTitle: "Inside Mortgage Finance",
    feedDescription:
      "Inside Mortgage Finance Publications, Inc. is a Bethesda, Maryland-based company providing business-to-business news and statistics to executives in the residential mortgage business.",
    feedUrl: "https://www.insidemortgagefinance.com/rss/articles",
    feedSiteUrl: "https://www.insidemortgagefinance.com/",
    sourceKind: "rss",
    itemTitle: "GSE Holdings of MBS Decline Again in July",
    itemSummary:
      "Despite a presidential directive to buy more MBS, the GSEs’ combined MBS holdings have declined for three straight months.",
    itemContentText:
      "Despite a presidential directive to buy more MBS, the GSEs’ combined MBS holdings have declined for three straight months.",
    itemUrl: "https://www.insidemortgagefinance.com/articles/238499-gses-continue-to-shed-mbs",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-4a4b3eb0",
    source: "stored",
    feedTitle: "Comprehensive Endpoint Security For Business Networks Archives | Fidelis Security",
    feedDescription: "Unified Threat Detection and Response Platform",
    feedUrl: "https://fidelissecurity.com/threatgeek/category/endpoint-security/feed",
    feedSiteUrl: "https://fidelissecurity.com/threatgeek/category/endpoint-security/",
    sourceKind: "rss",
    itemTitle:
      "Deception Technology Implementation Best Practices: A Practical Guide for Enterprise Security Teams",
    itemSummary:
      "Learn deception technology implementation best practices for enterprise security, from decoy placement and automation to integration and response. The post Deception Technology Implementation Best Practices: A Practical Guide for",
    itemContentText:
      "Key Takeaways Define deception goals around detection speed, threat intelligence, and team capacity before choosing a platform. Map your real environment so decoys match legitimate assets and attacker pathways. Extend deception across network, endpoint, identity, cloud, and IoT environments. Integrate deception alerts with SIEM, SOAR, XDR, EDR, and response workflows. Automate decoy deployment and continuously refresh breadcrumbs as environments change. Test decoys regularly",
    itemUrl:
      "https://fidelissecurity.com/threatgeek/deception/deception-technology-implementation-best-practices/",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-4c79b4b3",
    source: "stored",
    feedTitle: "Mercy For Animals Blog",
    feedDescription:
      "Get the latest news from the world of farmed animals, animal protection, and vegan eating. Mercy For Animals is an international non-profit animal advocacy organization dedicated to preventing",
    feedUrl: "https://mercyforanimals.org/feed",
    feedSiteUrl: "https://mercyforanimals.org/blog/",
    sourceKind: "rss",
    itemTitle: "“Choice Hotels Chickens Out” Campaign Drives Progress Toward Cage-Free Future",
    itemSummary:
      "Choice Hotels’ latest sustainability report shows significant progress on their cage-free egg commitment but with no clear roadmap and a missed 2025 deadline—raising ongoing concerns about transparency and accountability. The post “Choice",
    itemContentText:
      "With the release of their latest sustainability report , Choice Hotels has made measurable progress toward their cage-free commitment, though they have yet to fully meet their original goals. The company reports that 52% of their global hotel portfolio aligns with its cage-free commitment —an increase from last year, but far short of what’s needed to meet their original 2025 promise. This progress is no accident—it is the direct result of our Choice Hotels Chickens Out",
    itemUrl: "https://mercyforanimals.org/blog/choice-hotels-cage-free-progress/",
    expected: ["World & Society", "Business & Startups"],
    needsReview: true,
    note: "Animal welfare campaign vs corporation",
  },
  {
    id: "stored-4c87f9dc",
    source: "stored",
    feedTitle: "Stefani Within",
    feedDescription: "Finding my place in the world",
    feedUrl: "https://stefanihinojosa.com/feed",
    feedSiteUrl: "https://stefanihinojosa.com/",
    sourceKind: "rss",
    itemTitle: "Sunday Stefday",
    itemSummary:
      "Sunday is about over, and probably will be by the time I post this. Tomorrow begins another work week and I’m not ready for it. I just don’t have the energy for it. I enjoy my Stefani time. Yesterday (Saturday) I went with a friend to",
    itemContentText:
      "Sunday is about over, and probably will be by the time I post this. Tomorrow begins another work week and I’m not ready for it. I just don’t have the energy for it. I enjoy my Stefani time. Yesterday (Saturday) I went with a friend to Quartz Mountain Nature Park in Oklahoma and did some … Continue reading →",
    itemUrl: "https://stefanihinojosa.com/2020/08/03/sunday-stefday/",
    expected: ["Personal & Essays"],
  },
  {
    id: "stored-4c9b928c",
    source: "stored",
    feedTitle: "Blog - Detroit Baptist Theological Seminary",
    feedDescription: "Training Men for Ministry",
    feedUrl: "https://dbts.edu/blog/feed",
    feedSiteUrl: "https://dbts.edu/blog/",
    sourceKind: "rss",
    itemTitle: "Slavery in the Greco-Roman World",
    itemSummary:
      "In this episode of Theologically Driven, host Phil Cecil sits down with Dr. Ryan Meyer to explore one of the most challenging topics in New Testament studies: Paul’s view of slavery. Before diving into Paul’s letters, Dr. Meyer lays",
    itemContentText:
      "In this episode of Theologically Driven, host Phil Cecil sits down with Dr. Ryan Meyer to explore one of the most challenging topics in New Testament studies: Paul’s view of slavery. Before diving into Paul’s letters, Dr. Meyer lays essential groundwork by unpacking what slavery actually looked like in the first-century Greco-Roman world — and […] The post Slavery in the Greco-Roman World appeared first on Detroit Baptist Theological Seminary .",
    itemUrl: "https://dbts.edu/2026/05/28/slavery-in-the-greco-roman-world/",
    expected: ["World & Society"],
    needsReview: true,
    note: "Theology podcast on ancient slavery; no clear fit",
  },
  {
    id: "stored-4d216c06",
    source: "stored",
    feedTitle: "geopoliticalmatters.com",
    feedDescription:
      "Geopolitical Intelligence // GEÓ - First for EU-specific Geopolitical News & Intelligence",
    feedUrl: "https://geopoliticalmatters.com/feed",
    feedSiteUrl: "https://geopoliticalmatters.com/",
    sourceKind: "rss",
    itemTitle:
      "Europe’s Cybercrime Response Is Too Fragmented as Converging Threats Raise Strategic Risk",
    itemSummary:
      "Image Credit: Designed by Freepik via Magnific The post Europe’s Cybercrime Response Is Too Fragmented as Converging Threats Raise Strategic Risk appeared first on geopoliticalmatters.com .",
    itemContentText:
      "Gibraltar: Tuesday, 07 July 2026 – 08:00 CEST Europe’s Cybercrime Response Is Too Fragmented as Converging Threats Raise Strategic Risk GEÓ Intel: By: Iain Fraser – Security Editor GEÓPoliticalMatters.com/ First for Geopolitical Intel Google Indexed P1#2 on 070726 at 09:35 CET #GeopoliticalIntel #wef #cyberconvergence Europe’s Cybercrime Response Is Too Fragmented as Converging Threats Raise Strategic Risk Cybercrime is becoming a converged threat that increases operational,",
    itemUrl:
      "https://geopoliticalmatters.com/2026/07/07/converging-cybercrime-needs-different-response/",
    expected: ["Security & Privacy", "Politics & Policy"],
  },
  {
    id: "stored-4d21f350",
    source: "stored",
    feedTitle: "Anicca",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://anicca.co.uk/feed",
    feedSiteUrl: "https://anicca.co.uk/",
    sourceKind: "rss",
    itemTitle:
      "AI in Marketing & Management (1st Sep 26): Google’s Flagship Gap Widens as ChatGPT Ads Passes $1 Billion",
    itemSummary:
      "Google's Gemini Pro flagship delay widens as ChatGPT Ads passes $1 billion, Meta reportedly halts a second AI-driven layoff round, and Anicca AI & Insights turns one with the launch of Armadello Analytics & AI Insights. The post AI in",
    itemContentText:
      "Google’s Flagship Gap Widens as ChatGPT Ads Passes $1 Billion Google faces an awkward gap at the top of its model line-up after a Gemini Pro delay, while OpenAI previewed GPT-5.6 Sol as its answer and quietly pushed ChatGPT Ads past a $1 billion annualised revenue run rate in under 200 days. Salesforce and Anthropic deepened their partnership around Claude, Meta’s Zuckerberg reportedly pulled back a second wave of AI-driven layoffs after the technology underperformed",
    itemUrl: "https://anicca.co.uk/blog/2026-09-01-ai-in-marketing-management/",
    expected: ["AI & ML", "Business & Startups"],
  },
  {
    id: "stored-4dbe88e6",
    source: "stored",
    feedTitle: "HomeTheaterHifi.com",
    feedDescription: "Home Theater System and Audio Component Reviews",
    feedUrl: "https://hometheaterhifi.com/feed",
    feedSiteUrl: "https://hometheaterhifi.com/",
    sourceKind: "rss",
    itemTitle: "CEDIA 2026 Show Report",
    itemSummary:
      "We’re back in Denver this year for CEDIA EXPO 2026, running September 1-4 at the Colorado Convention Center, and this year, Editor-in-Chief Carlo Lo Raso will be on the show floor, training his eyes and ears to bring you the latest and",
    itemContentText:
      "We’re back in Denver this year for CEDIA EXPO 2026 , running September 1-4 at the Colorado Convention Center , and this year, Editor-in-Chief Carlo Lo Raso will be on the show floor, training his eyes and ears to bring you the latest and greatest that he discovers over the next few days. Expect a packed week of cutting-edge demos, fresh product launches, and technology that pushes the limits of home theater and custom installation. We’ll be updating this page daily with",
    itemUrl: "https://hometheaterhifi.com/features/cedia-2026-show-report/",
    expected: ["Technology"],
  },
  {
    id: "stored-4e07ac20",
    source: "stored",
    feedTitle: "JAMIEBUG CF CEPACIA LUNG TRANSPLANT",
    feedDescription:
      "Jamiebug- I have Cystic Fibrosis with Cepacia...Despite being told by almost every hospital in the country that I was not a candidate for a lung transplant due to Cepacia- I didn't give up and I",
    feedUrl: "http://jamiebug.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://jamiebug.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Eleven Years!!!",
    itemSummary:
      "I am so sorry, im a little ashamed when I saw my last post was almost over a year ago. Well take a deep breathe...I’m still healthy and happy and going strong. I recovered after 2 treatment of soul solumedral (IV STERIOD). The treatments",
    itemContentText:
      "I am so sorry, im a little ashamed when I saw my last post was almost over a year ago. Well take a deep breathe...I’m still healthy and happy and going strong. I recovered after 2 treatment of soul solumedral (IV STERIOD). The treatments sucked and I was grateful for them. I ended up losing about 15% FEV1 which just took some getting used to. I’m still at 74-77% but I haven’t hit the 90% since the rejection. I was so scared I was not going to around for my 10 yr transplant",
    itemUrl: "http://jamiebug.blogspot.com/2019/01/eleven-years.html",
    expected: ["Health & Medicine", "Personal & Essays"],
    needsReview: true,
    note: "Personal health blog; Health vs Personal ambiguous",
  },
  {
    id: "stored-50b317a2",
    source: "stored",
    feedTitle: "KISS THE BOOK",
    feedDescription: "Reviews for school librarians",
    feedUrl: "https://kissthebook.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://kissthebook.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "When It’s Your Turn for Midnight by Blessing Musariri - ADVISABLE",
    itemSummary:
      "When It’s Your Turn for Midnight by Blessing Musariri , 184 pages. Lerner, 2026. $19 Language: PG (7 swears, 0 ‘f’); Mature Content: PG (mental illness); Violence: PG-13 (# of dead bodies mentioned) BUYING ADVISORY: HS - ADVISABLE APPEALS",
    itemContentText:
      "When It’s Your Turn for Midnight by Blessing Musariri , 184 pages. Lerner, 2026. $19 Language: PG (7 swears, 0 ‘f’); Mature Content: PG (mental illness); Violence: PG-13 (# of dead bodies mentioned) BUYING ADVISORY: HS - ADVISABLE APPEALS TO: SEVERAL One moment 15yo Chianti is only worrying about getting her little sister out of trouble with their parents. The next her mother blurts out that her Baba (dad) is not even Chianti’s. Confused and hurt, Chianti flees to her",
    itemUrl: "https://kissthebook.blogspot.com/2026/08/when-its-your-turn-for-midnight-by.html",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-5197dabe",
    source: "stored",
    feedTitle: "News | Yelp - Official Blog",
    feedDescription: "Yelp Blog production site",
    feedUrl: "https://blog.yelp.com/category/news/feed",
    feedSiteUrl: "https://blog.yelp.com/category/news/",
    sourceKind: "rss",
    itemTitle: "Search less and do more with the new AI-powered Yelp Assistant",
    itemSummary:
      "Key updates from Yelp’s 2026 Spring Product Release: AI is now at the core of the Yelp experience. With this release, we’re taking the next major step in Yelp’s AI transformation. By combining our foundation of authentic, human-generated",
    itemContentText:
      "Key updates from Yelp’s 2026 Spring Product Release: The new AI-powered Yelp Assistant is redefining local discovery and helping you get things done by delivering reliable answers, recommendations, and seamless booking—from restaurant reservations to service appointments—all in one conversation. New integrations with Vagaro, Zocdoc, and Calendly make it easier to book, schedule, and order directly through Yelp. AI-powered Menu Vision is more visual and detail-rich, bringing",
    itemUrl: "https://blog.yelp.com/news/spring-product-release-2026/",
    expected: ["Technology", "AI & ML"],
    needsReview: true,
    note: "AI-powered app feature release: Technology vs AI & ML",
  },
  {
    id: "stored-522ab198",
    source: "stored",
    feedTitle: "ComicScene comic shop",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://comicscene.org/feed",
    feedSiteUrl: "https://comicscene.org/",
    sourceKind: "rss",
    itemTitle: "Nuts 1 & 2 – £10 each",
    itemSummary:
      "Nuts Writer: Stuart Lloyd Gould Nuts 1 The first of Stuarts books, introducing my main characters; Cyril the Squirrel, Eva the Beaver, Dave, Marmite and Treacle the Cats, Crispin the Chicken,Knox the Fox, Lee and Kai the Mice, Molly the",
    itemContentText:
      "Nuts Writer: Stuart Lloyd Gould Nuts 1 The first of Stuarts books, introducing my main characters; Cyril the Squirrel, Eva the Beaver, Dave, Marmite and Treacle the Cats, Crispin the Chicken,Knox the Fox, Lee and Kai the Mice, Molly the Mole, Walter the Otter, Al the Owl, Rae the Racoon and Diesel the Weasel. So we meet the characters and then go on an adventure. Nuts 2 Who stole Cyril’s Nuts and how can he get them back! So with his friends Eva the Beaver, Knox the Fox,",
    itemUrl: "https://comicscene.org/2026/07/10/nuts-1-2-10-each/",
    expected: [],
    needsReview: true,
    note: "Comic book product listing; could be Culture & Media",
  },
  {
    id: "stored-52e2714b",
    source: "stored",
    feedTitle: "Articles Archive - Hrana",
    feedDescription:
      "Human Rights Activists News Agency Hrana – News Agency | Human Rights Activists News Agency",
    feedUrl: "https://www.en-hrana.org/articles/feed",
    feedSiteUrl: "https://www.en-hrana.org/articles/",
    sourceKind: "rss",
    itemTitle:
      "Prisoners in the Shadow of War: A Responsibility That Cannot Be Lifted from the Shoulders of the State/ Sara Ghoreishi",
    itemSummary:
      "HRANA– With the escalation of military tensions and the possibility of expanding conflict, concerns about the safety of prisons and the lives of prisoners have significantly increased. Prisoners are among the most vulnerable groups in any",
    itemContentText:
      "HRANA – With the escalation of military tensions and the possibility of expanding conflict, concerns about the safety of prisons and the lives of prisoners have significantly increased. Prisoners are among the most vulnerable groups in any crisis situation, as they have no independent ability to decide where they live, access medical care, or even secure their most basic needs, and are entirely dependent on prison administrative structures. For this reason, in every legal",
    itemUrl:
      "https://www.en-hrana.org/articles/prisoners-in-the-shadow-of-war-a-responsibility-that-cannot-be-lifted-from-the-shoulders-of-the-state-sara-ghoreishi/",
    expected: ["World & Society"],
  },
  {
    id: "stored-53326504",
    source: "stored",
    feedTitle: "Elizabeth Anne Designs: The Wedding Blog",
    feedDescription: "Classic, Timeless Weddings",
    feedUrl: "https://elizabethannedesigns.com/feed",
    feedSiteUrl: "https://elizabethannedesigns.com/",
    sourceKind: "rss",
    itemTitle:
      "Casablanca Bridal’s Confidence Campaign: A Masterclass in Styling, Intention, and Design",
    itemSummary:
      "There are moments in bridal fashion when design extends beyond the gown. Moments when aesthetic choices, thoughtful details, and a carefully crafted environment come together to create an experience that feels both intimate and",
    itemContentText:
      "There are moments in bridal fashion when design extends beyond the gown. Moments when aesthetic choices, thoughtful details, and a carefully crafted environment come together to create an experience that feels both intimate and transformative. Casablanca Bridal ’s recent Confidence Campaign, held at Confidence Cove, was one such moment. Set within the Lu family home, newly envisioned for the occasion, the event invited guests into a serene and personal world that reflected",
    itemUrl:
      "https://elizabethannedesigns.com/2025/12/01/casablanca-bridals-confidence-campaign-a-masterclass-in-styling-intention-and-design/",
    expected: [],
    needsReview: true,
    note: "Bridal fashion campaign; fashion is none, maybe Culture & Media",
  },
  {
    id: "stored-53dc4eb0",
    source: "stored",
    feedTitle: "Insurance News",
    feedDescription: "Insurance News",
    feedUrl: "https://www.480insurance.com/blog/feed.xml",
    feedSiteUrl: "https://www.480insurance.com/blog",
    sourceKind: "rss",
    itemTitle: "How Moving Impacts Your Personal Insurance",
    itemSummary:
      "Moving boxes on a yellow couch by Ivan S Moving to a new home comes with a long list of tasks, and insurance updates are often overlooked in the process. However, a change in location, property type, vehicles, and daily routines can all",
    itemContentText:
      "Moving boxes on a yellow couch by Ivan S Moving to a new home comes with a long list of tasks, and insurance updates are often overlooked in the process. However, a change in location, property type, vehicles, and daily routines can all affect your coverage needs. Taking time to review your insurance before and after a move can help ensure your policies reflect your current situation and continue to provide appropriate protection. Homeowners, Renters, and Condo Insurance",
    itemUrl: "https://www.480insurance.com/blog/2026/05/how-moving-impacts-your-personal-insurance",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-5464252b",
    source: "stored",
    feedTitle: "Opinions | The Hindu",
    feedDescription:
      "The Hindu’s opinion section featuring a wide range of articles, editorials, and analysis covering various topics such as current affairs, politics, social issues, and more.",
    feedUrl: "https://www.thehindu.com/opinion/feeder/default.rss",
    feedSiteUrl: "https://www.thehindu.com/opinion/",
    sourceKind: "rss",
    itemTitle: "U.S. tariffs are not what is holding back Indian research",
    itemSummary:
      "The sectors most exposed to trade shocks barely overlap with those that invest in research",
    itemContentText:
      "The sectors most exposed to trade shocks barely overlap with those that invest in research",
    itemUrl:
      "https://www.thehindu.com/opinion/op-ed/us-tariffs-are-not-what-is-holding-back-indian-research/article71439924.ece",
    expected: ["Science & Research", "Politics & Policy"],
    needsReview: true,
    note: "Thin text; research investment vs trade policy opinion",
  },
  {
    id: "stored-54a63057",
    source: "stored",
    feedTitle: "Eco-Business » CSR",
    feedDescription:
      "News, opinion, videos, press releases, research, events & jobs on corporate social responsibility, sustainability, responsible investing, integrated reporting.",
    feedUrl: "https://www.eco-business.com/feeds/category/2",
    feedSiteUrl: "https://www.eco-business.com/category/csr/",
    sourceKind: "rss",
    itemTitle: "'Climate adaptation is economic investment, not a cost': UNDP senior official",
    itemSummary:
      "United Nations Development Programme's Edward Vrkić warned that underinvesting in adaptation could be far costlier, as Malaysia develops its first National Adaptation Plan and looks to attract private investment in climate resilience.",
    itemContentText:
      "United Nations Development Programme's Edward Vrkić warned that underinvesting in adaptation could be far costlier, as Malaysia develops its first National Adaptation Plan and looks to attract private investment in climate resilience.",
    itemUrl:
      "https://www.eco-business.com/news/climate-adaptation-is-economic-investment-not-a-cost-undp-senior-official/",
    expected: ["Climate & Environment"],
  },
  {
    id: "stored-54b94bf5",
    source: "stored",
    feedTitle: "Politics Archives - Yale University Press",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://yalebooks.yale.edu/category/politics/feed",
    feedSiteUrl: "https://yalebooks.yale.edu/category/politics/",
    sourceKind: "rss",
    itemTitle: "Field Guide to Falling Ill: A Conversation with Jonathan Gleason",
    itemSummary:
      "Field Guide to Falling Ill is Jonathan Gleason’s prizewinning collection of essays on disease,medicine, and humanity. We sit down with Gleason in this interview to discuss the capacity oflanguage to... READ MORE The post Field Guide to",
    itemContentText:
      "Field Guide to Falling Ill is Jonathan Gleason’s prizewinning collection of essays on disease, medicine, and humanity. We sit down with Gleason in this interview to discuss the capacity of language to express, experimental essays, HIV/AIDS, moving beyond medical establishments, the heart, and more. Tell us more about the title of Field Guide to Falling Ill . Jonathan Gleason: The title began as an homage to Rebecca Solnit’s brilliant collection of essays A Field Guide to",
    itemUrl:
      "https://yalebooks.yale.edu/2026/01/27/field-guide-to-falling-ill-a-conversation-with-jonathan-gleason/",
    expected: ["Culture & Media", "Health & Medicine"],
  },
  {
    id: "stored-5569f9c3",
    source: "stored",
    feedTitle: "Futurism",
    feedDescription: "Building the future together",
    feedUrl: "https://futurism.com/feed",
    feedSiteUrl: "https://futurism.com/",
    sourceKind: "rss",
    itemTitle:
      "Surveillance-Happy Police In Shambles After Trump Tariffs Makes Drones Absurdly Expensive",
    itemSummary:
      '"There is currently no economically viable domestic replacement" for Chinese drones, an officer complained. The post Surveillance-Happy Police In Shambles After Trump Tariffs Makes Drones Absurdly Expensive appeared first on Futurism .',
    itemContentText:
      "The surveillance state costs money, people! Well, tell that to president Trump. On Thursday, he slapped a 100 percent tariff — he sure loves round numbers and levying imports — on larger foreign-made drones. Trump claimed that this “bolsters national security.” But, ironically, it could be undermining domestic security — at least according to surveillance-happy police departments who’ve gotten used to overlooking their subjects from above , according to a roundup of",
    itemUrl: "https://futurism.com/robots-and-machines/surveillance-piolice-trump-tariffs-drones",
    expected: ["Politics & Policy", "Security & Privacy"],
    needsReview: true,
    note: "Tariffs vs police drone surveillance; Politics vs Security",
  },
  {
    id: "stored-596f6557",
    source: "stored",
    feedTitle: "WorkFusion",
    feedDescription: "AI for AML risk mitigation",
    feedUrl: "https://www.workfusion.com/feed",
    feedSiteUrl: "https://www.workfusion.com/",
    sourceKind: "rss",
    itemTitle:
      "The Workforce Rewrite: How AI Is Reshaping the Future of Financial Crime Compliance Work",
    itemSummary:
      "Financial crime compliance (FCC) is in the middle of a generational shift — one unlike anything the industry has experienced since the post‑9/11 regulatory overhaul. But this time, the catalyst isn’t regulation. It’s the structural",
    itemContentText:
      "Financial crime compliance (FCC) is in the middle of a generational shift — one unlike anything the industry has experienced since the post‑9/11 regulatory overhaul. But this time, the catalyst isn’t regulation. It’s the structural mismatch between decades‑old, labor‑scaled operating models and the real‑time, high‑velocity financial system they’re expected to protect. AI has become the engine of this transformation. And nowhere is the impact more profound — or more",
    itemUrl: "https://www.workfusion.com/blog/how-ai-is-reshaping-financial-crime-compliance-work/",
    expected: ["AI & ML", "Finance & Markets"],
    needsReview: true,
    note: "AI in financial crime compliance; workforce angle too",
  },
  {
    id: "stored-5b21329e",
    source: "stored",
    feedTitle: "Environmental, Health and Safety News",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://feeds.feedburner.com/EnvironmentalHealthSafety",
    feedSiteUrl: "http://ehsmanager.blogspot.com/",
    sourceKind: "rss",
    itemTitle:
      "Reduction of daily-use parabens and phthalates reverses accumulation of cancer-associated phenotypes within disease-free breast tissue of study subjects",
    itemSummary:
      "October 1st marks the beginning of Breast Cancer Awareness Month, a time dedicated to raising awareness about breast cancer and promoting early detection and research efforts. This month serves as a reminder to focus not only on screenings",
    itemContentText:
      "October 1st marks the beginning of Breast Cancer Awareness Month, a time dedicated to raising awareness about breast cancer and promoting early detection and research efforts. This month serves as a reminder to focus not only on screenings and treatments but also on the everyday factors that could influence breast health. One such area gaining attention is the role of chemicals found in personal care products and their potential link to breast cancer risk. This research",
    itemUrl: "http://ehsmanager.blogspot.com/2024/10/reduction-of-daily-use-parabens-and.html",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-5babe82e",
    source: "stored",
    feedTitle: "World update",
    feedDescription: "Latest updates include every prospect of life",
    feedUrl: "https://worldupdatedaily.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://worldupdatedaily.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "China Pulls No Punches In Coronavirus Words War",
    itemSummary:
      'For more than three decades, China\'s ruling Communist Party experienced one of the greatest political crises. A rapidly spreading outbreak of the new coronavirus was a "huge danger and threat" to social stability, Chinese President Xi',
    itemContentText:
      'For more than three decades, China\'s ruling Communist Party experienced one of the greatest political crises. A rapidly spreading outbreak of the new coronavirus was a "huge danger and threat" to social stability, Chinese President Xi Jinping cautioned top party officials in a later publicly-published internal address. Yet with new domestic infections near zero, China declared victory over a virus that is still struggling to curb. Newly optimistic and prone to criticism that',
    itemUrl:
      "https://worldupdatedaily.blogspot.com/2020/05/china-pulls-no-punches-in-coronavirus.html",
    expected: ["World & Society", "Politics & Policy"],
    needsReview: true,
    note: "China coronavirus politics; World vs Politics vs Health",
  },
  {
    id: "stored-5cba7568",
    source: "stored",
    feedTitle: "Strate School of Design",
    feedDescription: "Bangalore",
    feedUrl: "https://strate.in/feed",
    feedSiteUrl: "https://strate.in/",
    sourceKind: "rss",
    itemTitle: "How the Outdated Design of Indian Cities Leads to Extremely Poor Living Standards",
    itemSummary:
      "By now, we all have heard or read news about potholes in Bangalore causing massive issues, or that roads being dug up in Mumbai have actually doubled the traffic, or the massive waste and sewage disposal on the side of the road in Kolkata",
    itemContentText:
      "By now, we all have heard or read news about potholes in Bangalore causing massive issues, or that roads being dug up in Mumbai have actually doubled the traffic, or the massive waste and sewage disposal on the side of the road in Kolkata is eating up walkable spaces. These issues aren’t outliers, and are neither specific to these cities. It’s a problem that the whole country suffers from, while only a fair few, owing to their metropolitan or urban status, get highlighted.",
    itemUrl: "https://strate.in/urban-planning-in-india-poor-city-design-living-standards/",
    expected: ["Design & UX", "World & Society"],
    needsReview: true,
    note: "Urban planning critique; design vs society",
  },
  {
    id: "stored-5ce16dd3",
    source: "stored",
    feedTitle: "Ecology Research News -- ScienceDaily",
    feedDescription:
      "Learn about recent research into biodiversity reduction and how it affects ecosystems. Read news articles on coral bleaching, deforestation and wetland ecology.",
    feedUrl: "https://www.sciencedaily.com/rss/earth_climate/ecology.xml",
    feedSiteUrl: "https://www.sciencedaily.com/news/earth_climate/ecology/",
    sourceKind: "rss",
    itemTitle:
      "Scientists discover the Southern Ocean is “sweating” more as climate change intensifies",
    itemSummary:
      "A remote island between Australia and Antarctica is showing signs of a dramatic climate transformation. Scientists found storms over Macquarie Island now unleash much heavier rainfall than they did decades ago, soaking ecosystems and",
    itemContentText:
      "A remote island between Australia and Antarctica is showing signs of a dramatic climate transformation. Scientists found storms over Macquarie Island now unleash much heavier rainfall than they did decades ago, soaking ecosystems and altering fragile vegetation. The discovery hints that the Southern Ocean — one of Earth’s biggest climate regulators — may be changing faster than expected. Researchers say the ocean could now be cooling itself by “sweating” more moisture into",
    itemUrl: "https://www.sciencedaily.com/releases/2026/05/260512202337.htm",
    expected: ["Climate & Environment", "Science & Research"],
  },
  {
    id: "stored-5e05e09c",
    source: "stored",
    feedTitle: "Systems of Romance",
    feedDescription: "Systems of Romance",
    feedUrl: "https://www.systemsofromance.com/blog/feed",
    feedSiteUrl: "https://www.systemsofromance.com/blog",
    sourceKind: "rss",
    itemTitle: "The Wild Side – Cold As Ice 7”",
    itemSummary:
      "I dunno what it is about 1981, but most of my favorite DIY post-punk records from the UK (or anywhere else really) come exclusively from this year. Must have been something in the water. Anyway, I’ve had this single for a while now, but",
    itemContentText:
      "I dunno what it is about 1981, but most of my favorite DIY post-punk records from the UK (or anywhere else really) come exclusively from this year. Must have been something in the water. Anyway, I’ve had this single for a while now, but just getting around to posting it. No, the a-side is not a cover of the stone-cold killer 1977 track by everyone’s favorite butt-rock band Foreigner, but is instead a jangly, frenetic, piano, guitar, and feedback driven post-punk track that",
    itemUrl: "https://www.systemsofromance.com/blog/2026/08/the-wild-side-cold-as-ice-7/",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-5e920ca8",
    source: "stored",
    feedTitle: "World update",
    feedDescription: "Latest updates include every prospect of life",
    feedUrl: "https://worldupdatedaily.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://worldupdatedaily.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Designing a logo",
    itemSummary:
      "Ever seen a major brand without a logo? No? No? That's because there's none. A logo influences how your customers view your brand. You want the logo to be outstanding. But how you get there? Don't worry! This handy guide will teach you how",
    itemContentText:
      "Ever seen a major brand without a logo? No? No? That's because there's none. A logo influences how your customers view your brand. You want the logo to be outstanding. But how you get there? Don't worry! This handy guide will teach you how to design the perfect logo for you and your company. Learn how to design a logo, including identifying the essence of your brand and knowing what makes a perfect logo, making the right design choices and managing the design process. Here",
    itemUrl: "https://worldupdatedaily.blogspot.com/2020/04/designing-logo.html",
    expected: ["Design & UX"],
  },
  {
    id: "stored-5eb00d8c",
    source: "stored",
    feedTitle: "Wayfaring With Wagner",
    feedDescription: "Endless Curiosity. Insatiable Wanderlust.",
    feedUrl: "https://www.wayfaringwithwagner.com/feed",
    feedSiteUrl: "https://www.wayfaringwithwagner.com/",
    sourceKind: "rss",
    itemTitle: "Looking Back on 2018",
    itemSummary:
      "What a year! I feel like a broken record but every year seems better than the last! I’d say that 2018 was easily the best year for my blog, the best year career-wise, and my best year personally with the Prince. Additionally, I finally",
    itemContentText:
      "What a year! I feel like a broken record but every year seems better than the last! I’d say that 2018 was easily the best year for my blog, the best year career-wise, and my best year personally with the Prince. Additionally, I finally feel settled in Hamburg – I’ve joined a few different organizations and have a solid friend group here. I always feel like my travels will never live up to the previous year. Yet, it seems to get even crazier! I might not have visited many new",
    itemUrl: "https://www.wayfaringwithwagner.com/looking-back-on-2018-2/",
    expected: ["Personal & Essays", "Food & Travel"],
    needsReview: true,
    note: "Travel blog year-in-review; personal vs travel",
  },
  {
    id: "stored-60b02a7b",
    source: "stored",
    feedTitle: "Donald Trump - Breaking News, Photos and Videos | The Hill",
    feedDescription: "Unbiased Politics News",
    feedUrl: "https://thehill.com/people/donald-trump/feed",
    feedSiteUrl: "https://thehill.com/",
    sourceKind: "rss",
    itemTitle: "Federal Reserve is expected to raise its benchmark rate, defying Trump's demands",
    itemSummary:
      "WASHINGTON (AP) — The Federal Reserve is widely expected to lift its short-term interest rate Wednesday for the first time in three years to fight stubbornly high inflation, a move that would put the central bank at odds with President",
    itemContentText:
      "WASHINGTON (AP) — The Federal Reserve is widely expected to lift its short-term interest rate Wednesday for the first time in three years to fight stubbornly high inflation, a move that would put the central bank at odds with President Donald Trump's support for a cut. A quarter-point increase in the Fed's rate, currently about...",
    itemUrl: "https://thehill.com/business/federal-reserve-interest-rate-donald-trump/",
    expected: ["Finance & Markets", "Politics & Policy"],
  },
  {
    id: "stored-60cbd573",
    source: "stored",
    feedTitle: "Northern Spain Travel",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://northernspaintravel.com/feed",
    feedSiteUrl: "https://northernspaintravel.com/",
    sourceKind: "rss",
    itemTitle: "10 Best Beaches in Asturias for Luxury Travel",
    itemSummary:
      "The best beaches in Asturias aren't necessarily the largest, most famous, or easiest to reach. A dramatic cove may be perfect for a private sunset, but unsuitable for swimming. A family-friendly beach may offer better access and services,",
    itemContentText:
      "The best beaches in Asturias aren't necessarily the largest, most famous, or easiest to reach. A dramatic cove may be perfect for a private sunset, but unsuitable for swimming. A family-friendly beach may offer better access and services, while a wilder shore delivers the solitude affluent travelers want. Asturias has more than 200 coves and sandy beaches , and regional tourism material notes that no two are the same because the scenery changes from west to east. That",
    itemUrl:
      "https://northernspaintravel.com/travel-guide/10-best-beaches-in-asturias-for-luxury-travel/",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-615dd93b",
    source: "stored",
    feedTitle: "Business Worldwide Magazine",
    feedDescription: "International Business | Corporate News | Business Strategy",
    feedUrl: "https://www.bwmonline.com/feed",
    feedSiteUrl: "https://www.bwmonline.com/",
    sourceKind: "rss",
    itemTitle: "Accelerating Molecules to Medicines: A Leader’s Blueprint for Pharma",
    itemSummary:
      "Synopsis: With drug development timelines stretching toward a decade, the pharmaceutical industry faces growing pressure to rethink how medicines are made. Drawing on decades of industry experience, Dr Chris H. Senanayake, Founder and CEO",
    itemContentText:
      "Synopsis: With drug development timelines stretching toward a decade, the pharmaceutical industry faces growing pressure to rethink how medicines are made. Drawing on decades of industry experience, Dr Chris H. Senanayake, Founder and CEO of TCG GreenChem, is driving a greener, faster, and more integrated model for turning molecules into medicines. For more than 35 years, Dr Senanayake has been at the forefront of pharmaceutical science and green chemistry. From Dow and",
    itemUrl:
      "https://www.bwmonline.com/sector-watch/healthcare/accelerating-molecules-to-medicines-a-leaders-blueprint-for-pharma/",
    expected: ["Business & Startups", "Health & Medicine"],
    needsReview: true,
    note: "Pharma executive profile; Business vs Health",
  },
  {
    id: "stored-645110a5",
    source: "stored",
    feedTitle: "MyFitnessChat",
    feedDescription: "A blog on everything health and wellbeing.",
    feedUrl: "https://www.myfitnesschat.com/feed",
    feedSiteUrl: "https://www.myfitnesschat.com/",
    sourceKind: "rss",
    itemTitle: "Self-Care Saturday: 20 Budget-Friendly ways to Relax and Destress",
    itemSummary:
      "20 budget-friendly ways to relax and destress! Taking breaks to relax and destress is essential […] The post Self-Care Saturday: 20 Budget-Friendly ways to Relax and Destress appeared first on MyFitnessChat .",
    itemContentText:
      "20 budget-friendly ways to relax and destress! Taking breaks to relax and destress is essential for our mind and body. A self-care day can significantly boost productivity when you return to work by reenergizing and rejuvenating yourself. Here at Epassi we have come up with a list of 20 budget-friendly ways to relax and destress! Take a hot/cold shower A refreshing shower, whether hot or cold, can help relax your mind and body, washing away stress and tension. Spend a few",
    itemUrl:
      "https://www.myfitnesschat.com/self-care-saturday-20-budget-friendly-ways-to-relax-and-destress/",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-65e37ba9",
    source: "stored",
    feedTitle: "News | Yelp - Official Blog",
    feedDescription: "Yelp Blog production site",
    feedUrl: "https://blog.yelp.com/category/news/feed",
    feedSiteUrl: "https://blog.yelp.com/category/news/",
    sourceKind: "rss",
    itemTitle:
      "Transforming Yelp with AI: Smarter search, seamless connections, instant answers and a more conversational experience",
    itemSummary:
      "Today, Yelp is taking its biggest leap yet toward transforming local discovery with AI—making it easier and faster than ever for you to connect with great local businesses and get things done. The post Transforming Yelp with AI: Smarter",
    itemContentText:
      "Key updates from Yelp’s 2025 Fall Product Release: The new Yelp Assistant uses AI to instantly answer any question you have about a restaurant, bar, local attraction, retailer, and more. A new AI-powered feature, Menu Vision , makes it easier to decide what to order by letting you point your phone at a menu to see photos, reviews, and details for dishes. Two new AI-powered call answering solutions— Yelp Host and Yelp Receptionist —help restaurants and local businesses manage",
    itemUrl: "https://blog.yelp.com/news/fall-product-release-2025/",
    expected: ["AI & ML", "Technology"],
    needsReview: true,
    note: "Yelp AI features; AI & ML vs Technology",
  },
  {
    id: "stored-669d154b",
    source: "stored",
    feedTitle: "Luxury Drug and Alcohol Rehab in Granada Hills, CA | Uplift Recovery",
    feedDescription: "Luxury Drug and Alcohol Rehab in Granada Hills, CA",
    feedUrl: "https://upliftrecovery.com/feed",
    feedSiteUrl: "https://upliftrecovery.com/",
    sourceKind: "rss",
    itemTitle: "Should You Date While in Recovery? Pros & Cons",
    itemSummary:
      "TL;DR: Whether to start dating in recovery depends on timing, stability, and support. Below you’ll find pros and cons, a The post Should You Date While in Recovery? Pros & Cons appeared first on Luxury Drug and Alcohol Rehab in Granada",
    itemContentText:
      "Addiction Spotlight , Recovery Tips Should You Date While in Recovery? Pros & Cons October 7, 2025 TL;DR: Whether to start dating in recovery depends on timing, stability, and support. Below you’ll find pros and cons, a readiness checklist, boundaries to set before you date, and how Uplift can help you keep sobriety first. Why Dating Decisions Matter in Early Recovery Dating in Recovery: Pros & Cons Are You Ready? A Quick Check Set Boundaries Before You Date How Uplift",
    itemUrl: "https://upliftrecovery.com/should-you-date-while-in-recovery-pros-cons/",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-6736ca94",
    source: "stored",
    feedTitle: "Africa Chess",
    feedDescription:
      "Africa Chess is the platform for chess players across Africa and friends of chess in Africa to tell their own stories so that they might inspire the next generation of chess players in Africa. The",
    feedUrl: "https://africachess.net/feed",
    feedSiteUrl: "https://africachess.net/",
    sourceKind: "rss",
    itemTitle: "Reflections on the 2024 SA Closed Final from Dr CM Lyndon Bouah",
    itemSummary: "Reflections on the 2024 SA Closed Final from Dr CM Lyndon Bouah",
    itemContentText: "Reflections on the 2024 SA Closed Final from Dr CM Lyndon Bouah",
    itemUrl:
      "https://africachess.net/reflections-on-the-2024-sa-closed-final-from-dr-cm-lyndon-bouah/",
    expected: ["Sports"],
    needsReview: true,
    note: "Chess reflections; title-only text",
  },
  {
    id: "stored-676f2745",
    source: "stored",
    feedTitle: "RSS de noticias de deportes/futbol",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.abc.es/rss/atom/deportes/futbol",
    feedSiteUrl: "http://www.abc.es/rss/atom/deportes/futbol/",
    sourceKind: "rss",
    itemTitle: "Ferran sigue en una nube: hat-trick en su estreno en la Champions con el PSG",
    itemSummary:
      "El delantero español firmó tres goles ante el Slovan Bratislava y certifica su idilio parisino, mientras el equipo de Luis Enrique aún no despega en la liga francesa",
    itemContentText:
      "El delantero español firmó tres goles ante el Slovan Bratislava y certifica su idilio parisino, mientras el equipo de Luis Enrique aún no despega en la liga francesa",
    itemUrl:
      "https://www.abc.es/deportes/futbol/ferran-sigue-nube-hattrick-estreno-champions-psg-20260910093103-nt.html",
    expected: ["Sports"],
  },
  {
    id: "stored-678b3575",
    source: "stored",
    feedTitle: "nps.gov - Cape Cod National Seashore - News Releases",
    feedDescription: "News releases from Cape Cod National Seashore.",
    feedUrl: "https://www.nps.gov/feeds/getnewsrss.htm?id=caco",
    feedSiteUrl: "https://www.nps.gov/caco",
    sourceKind: "rss",
    itemTitle: "Cape Cod National Seashore Beach Safety",
    itemSummary:
      "Although the summer season is coming to a close, visitors are still coming to Cape Cod National Seashore to enjoy its abundant recreational opportunities, and for rest and rejuvenation. We want to remind our visitors that our seashore",
    itemContentText:
      "Although the summer season is coming to a close, visitors are still coming to Cape Cod National Seashore to enjoy its abundant recreational opportunities, and for rest and rejuvenation. We want to remind our visitors that our seashore lifeguards end their season on Labor Day, September 4. https://www.nps.gov/caco/learn/news/beach-safety-fall-2017.htm",
    itemUrl: "https://www.nps.gov/caco/learn/news/beach-safety-fall-2017.htm",
    expected: ["World & Society"],
    needsReview: true,
    note: "Park beach safety notice; World vs Travel",
  },
  {
    id: "stored-67ede343",
    source: "stored",
    feedTitle: "Law Office of Kathleen Flynn",
    feedDescription:
      "Atlanta Social Security Disability Attorney | Georgia Social Security Benefits",
    feedUrl: "https://www.kathleenflynnlaw.com/feed",
    feedSiteUrl: "https://www.kathleenflynnlaw.com/",
    sourceKind: "rss",
    itemTitle: "Social Security’s 80th Anniversary",
    itemSummary:
      "Marking a Social Security Milestone August 14, 2015 is the 80th anniversary of Social Security. Few Americans working today can remember a time when Social Security wasn’t part of the social fabric of America. Since the Social Security",
    itemContentText:
      "Marking a Social Security Milestone August 14, 2015 is the 80th anniversary of Social Security. Few Americans working today can remember a time when Social Security wasn’t part of the social fabric of America. Since the Social Security retirement program was enacted under Franklin Delano Roosevelt in 1935, it has expanded in important ways. In 1939, benefits for dependent survivors of wage earners were added. And in 1956, disability insurance benefits were added. Today, as",
    itemUrl: "https://www.kathleenflynnlaw.com/social-securitys-80th-anniversity/",
    expected: ["Politics & Policy"],
    needsReview: true,
    note: "Social Security history plus law-firm testimonial",
  },
  {
    id: "stored-691164f9",
    source: "stored",
    feedTitle: "CLIMATE CHANGE THE FACTS",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://climatechangethefacts.org.au/feed",
    feedSiteUrl: "https://climatechangethefacts.org.au/",
    sourceKind: "rss",
    itemTitle: "The Carbon Dioxide Climate Myth",
    itemSummary:
      "Our friends at The Climate Study Group have just published the latest in their informative series of articles in The Australian , on […] The post The Carbon Dioxide Climate Myth appeared first on CLIMATE CHANGE THE FACTS .",
    itemContentText:
      "Our friends at The Climate Study Group have just published the latest in their informative series of articles in The Australian , on December 9 th . Click here to view PDF. The post The Carbon Dioxide Climate Myth appeared first on CLIMATE CHANGE THE FACTS .",
    itemUrl: "https://climatechangethefacts.org.au/2023/12/09/the-carbon-dioxide-climate-myth_/",
    expected: ["Climate & Environment"],
  },
  {
    id: "stored-69d822fe",
    source: "stored",
    feedTitle: "Boardroom: AI and SEO Dashboard for E-Commerce",
    feedDescription: "Where entrepreneurs make decisions.",
    feedUrl: "https://www.ecommboardroom.com/feed",
    feedSiteUrl: "https://www.ecommboardroom.com/",
    sourceKind: "rss",
    itemTitle: "E-commerce Analytics Tools: Complete Comparison Guide for 2026",
    itemSummary:
      "Stop Flying Blind on Your Store’s Performance You’re spending on ads, optimizing product pages, running promotions — and at the end of the month, you’re not entirely sure which of those moves actually worked. That’s not a strategy problem.",
    itemContentText:
      "Stop Flying Blind on Your Store’s Performance You’re spending on ads, optimizing product pages, running promotions — and at the end of the month, you’re not entirely sure which of those moves actually worked. That’s not a strategy problem. That’s a data visibility problem. The right e-commerce analytics tool fixes that. It pulls your scattered sales, traffic, and marketing data into one place, surfaces what’s actually driving revenue, and helps you make faster, more",
    itemUrl: "https://www.ecommboardroom.com/ecommerce-analytics-tool",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-6ca1ba5c",
    source: "stored",
    feedTitle: "Chemistry : nature.com subject feeds",
    feedDescription: "Latest news and research from Nature.com on the topic of Chemistry",
    feedUrl: "https://www.nature.com/subjects/chemistry.rss",
    feedSiteUrl: "https://www.nature.com/subjects/chemistry",
    sourceKind: "rss",
    itemTitle:
      "Tackling chlorine poisoning for robust upcycling of PVC-contaminated plastic streams",
    itemSummary: null,
    itemContentText:
      "Article Open access Published: 14 September 2026 Nature Communications (2026) Cite this article We’re sharing this article early to provide faster access to peer-reviewed, accepted research. It is citable and carries a permanent DOI. This version is subject to further edits and will be replaced automatically by the final Version of Record. All legal disclaimers apply. Abstract Catalytic upcycling of polyolefin waste into valuable chemicals presents a promising solution to",
    itemUrl: "https://www.nature.com/articles/s41467-026-77736-1",
    expected: ["Science & Research", "Climate & Environment"],
  },
  {
    id: "stored-6e146a70",
    source: "stored",
    feedTitle: "National Centre for Eating Disorders",
    feedDescription:
      "Effective help & treatment for sufferers | Excellence in training for professionals",
    feedUrl: "https://eating-disorders.org.uk/feed",
    feedSiteUrl: "https://eating-disorders.org.uk/",
    sourceKind: "rss",
    itemTitle: "Pronouns and the Law",
    itemSummary:
      "As I ponder the MoU and its rationale among the counselling authorities, I am reminded that the basic philosophy about gender identity comes from a subtle reframing of what it is to be human according to our Society “social justice”",
    itemContentText:
      "As I ponder the MoU and its rationale among the counselling authorities, I am reminded that the basic philosophy about gender identity comes from a subtle reframing of what it is to be human according to our Society “social justice” perspectives. Contemporary gender ideology increasingly treats the physical body as incidental and something to be overridden by internal identity rather than integrated and accepted. This shift is not just philosophical. It is reflected in",
    itemUrl: "https://eating-disorders.org.uk/pronouns-and-the-law/",
    expected: ["World & Society", "Health & Medicine"],
    needsReview: true,
    note: "Gender therapy MoU opinion; Society vs Policy vs Health",
  },
  {
    id: "stored-6ef4cea2",
    source: "stored",
    feedTitle: "Australian Academy of Interior Design Blog",
    feedDescription:
      "The Australian Academy of Interior Design is a leading provider of home study and classroom-based interior design courses in Australia.",
    feedUrl: "https://www.aaid.edu.au/feed",
    feedSiteUrl: "https://www.aaid.edu.au/blogs",
    sourceKind: "rss",
    itemTitle: "How Do I Know if I Want to be an Interior Designer?",
    itemSummary:
      "Interior design is a fast-paced and rewarding career that involves a unique combination of both creative and analytical skills. An interior design scheme is more than creating a nice looking space, it involves problem solving and",
    itemContentText:
      "Interior design is a fast-paced and rewarding career that involves a unique combination of both creative and analytical skills. An interior design scheme is more than creating a nice looking space, it involves problem solving and innovation in order to achieve a design that is both functional and aesthetically pleasing. Interior designers must find a balance between expressing their artistic vision and meeting the needs of the client. There is also an element of adaptability",
    itemUrl: "https://www.aaid.edu.au/blog/how-do-i-know-if-i-want-to-be-an-interior-designer-",
    expected: ["Education & Work", "Design & UX"],
  },
  {
    id: "stored-6fc0e88a",
    source: "stored",
    feedTitle: "MIT News - Machine learning",
    feedDescription: "MIT news feed about: Machine learning",
    feedUrl: "https://news.mit.edu/rss/topic/machine-learning",
    feedSiteUrl: "https://news.mit.edu/rss/topic/machine-learning",
    sourceKind: "rss",
    itemTitle:
      "The MIT-IBM Computing Research Lab launches to shape the future of AI and quantum computing",
    itemSummary:
      "Building on a long-standing MIT–IBM collaboration, the new lab will chart the convergence of AI, algorithms, and quantum computing.",
    itemContentText:
      "The following is a joint announcement by the MIT Schwarzman College of Computing and IBM. IBM and MIT today announced the launch of the MIT-IBM Computing Research Lab, advancing their long-standing collaboration to shape the next era of computing. The new lab expands its scope to include quantum computing, alongside foundational artificial intelligence research, with the goal of unlocking new computational approaches that go beyond the limits of today’s classical systems.",
    itemUrl: "https://news.mit.edu/2026/mit-ibm-computing-research-lab-launches-0429",
    expected: ["AI & ML", "Science & Research"],
  },
  {
    id: "stored-70177ab9",
    source: "stored",
    feedTitle: "Code4IT",
    feedDescription: "Recent content on Code4IT",
    feedUrl: "https://www.code4it.dev/index.xml",
    feedSiteUrl: "https://www.code4it.dev/",
    sourceKind: "rss",
    itemTitle: "Code opinion: why I prefer avoiding the Async suffix in C# asynchronous methods",
    itemSummary:
      "Should every asynchronous method name end with Async? Does it bring more benefits or more downsides? Let’s reason about this habit, which is common among C# developers.",
    itemContentText:
      "Should every asynchronous method name end with Async? Does it bring more benefits or more downsides? Let&rsquo;s reason about this habit, which is common among C# developers.",
    itemUrl: "https://www.code4it.dev/blog/code-opinion-async-suffix/",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-70462600",
    source: "stored",
    feedTitle: "Young Adult Reviews – Maya's Reviews",
    feedDescription: "BOOK AND MOVIE REVIEWS",
    feedUrl: "https://mayagreviews.wordpress.com/category/reviews/young-adult-reviews/feed",
    feedSiteUrl: "https://mayagreviews.wordpress.com/",
    sourceKind: "rss",
    itemTitle: "Interview with director Joyce Chopra, author of Lady Director",
    itemSummary:
      "I had the delightful chance to speak with director Joyce Chopra about her upcoming memoir, Lady Director , and inspiring account of her life thus far.",
    itemContentText:
      "Pre-order your copy of Lady Director here. Read my review of Lady Director here. I’d like to start this post off by thanking City Light Books for not only reaching out to me, but also for providing me with a copy of Lady Director and helping to set up an interview between Joyce Chopra and I. I had an excellent time discussing Chopra’s book during our interview, and I’m sure you will be as inspired as I was. Lady Director is set to be published on November 22, 2022. I highly",
    itemUrl:
      "https://mayagreviews.wordpress.com/2022/11/05/interview-with-director-joyce-chopra-author-of-lady-director/",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-705d479a",
    source: "stored",
    feedTitle: "Algorithms, Blockchain and Cloud",
    feedDescription: "The Ultimate Computer Technology Blog - The Knowledgebase of Computing",
    feedUrl: "https://feeds.feedburner.com/helloacm",
    feedSiteUrl: "https://helloacm.com/",
    sourceKind: "rss",
    itemTitle: "C++ what is the consteval? How is it different to const and constexpr?",
    itemSummary:
      "C++: What is consteval? How is it Different from const and constexpr? If you’ve been using const and constexpr in your C++ code, you might be wondering what the new consteval keyword in C++20 brings to the table. Let’s break it down",
    itemContentText:
      "C++: What is consteval? How is it Different from const and constexpr? If you’ve been using const and constexpr in your C++ code, you might be wondering what the new consteval keyword in C++20 brings to the table. Let’s break it down clearly. What is consteval? The consteval specifier declares a function as an immediate function, meaning the function must be evaluated at compile time. Unlike constexpr, which allows both compile-time and runtime evaluation, consteval enforces",
    itemUrl:
      "https://helloacm.com/c-what-is-the-consteval-how-is-it-different-to-const-and-constexpr/",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-7110da66",
    source: "stored",
    feedTitle: "Stories by Rate My Service on Medium",
    feedDescription: "Stories by Rate My Service on Medium",
    feedUrl: "https://medium.com/feed/@ratemyservice",
    feedSiteUrl: "https://medium.com/@ratemyservice?source=rss-e8f71de5f722------2",
    sourceKind: "rss",
    itemTitle: "Transforming insurance CX through WhatsApp and conversational AI",
    itemSummary:
      "Customers today expect instant, personalised and seamless interactions. For African insurers, this means fundamentally rethinking how we engage policyholders across the entire customer lifecycle — from onboarding and servicing to claims",
    itemContentText:
      "Customers today expect instant, personalised and seamless interactions. For African insurers, this means fundamentally rethinking how we engage policyholders across the entire customer lifecycle — from onboarding and servicing to claims and renewals. 🚗You’re driving home on Nairobi’s Thika Road when a pothole suddenly sends you swerving into the curb — your wheel rim bent and your fender dented. Stranded and stressed, you open WhatsApp, message your insurer’s claims bot and",
    itemUrl:
      "https://medium.com/winning-with-cx/transforming-insurance-cx-through-whatsapp-and-conversational-ai-6abc2d4e1995?source=rss-e8f71de5f722------2",
    expected: ["Business & Startups", "AI & ML"],
  },
  {
    id: "stored-71e6392d",
    source: "stored",
    feedTitle: "Ships Machinery – MARINE ENGINEERING AT A GLANCE",
    feedDescription: "MARINE ENGINEERING AT A GLANCE",
    feedUrl: "https://marinediesel.co.in/ships-machinery/feed",
    feedSiteUrl: "https://marinediesel.co.in/",
    sourceKind: "rss",
    itemTitle: "Marine Diesel Oil Pump Issues: A Practical Guide",
    itemSummary:
      "Oil pump issues are among the most critical challenges encountered in marine engines today. Marine Diesel Oil Pump Issues can rapidly escalate, ... Read more",
    itemContentText:
      "Oil pump issues are among the most critical challenges encountered in marine engines today. Marine Diesel Oil Pump Issues can rapidly escalate, ... Read more",
    itemUrl: "https://marinediesel.co.in/marine-diesel-oil-pump-issues/",
    expected: [],
    needsReview: true,
    note: "Marine engineering maintenance how-to; no clear label",
  },
  {
    id: "stored-71f03e59",
    source: "stored",
    feedTitle: "Ice Cream University",
    feedDescription:
      "Ice cream business seminars, ice cream consulting, ingredients, books and resources for those in or starting in the ice cream business.",
    feedUrl: "https://icecreamuniversity.org/blogs/ice-cream-business-tips-tricks.atom",
    feedSiteUrl: "https://icecreamuniversity.org/blogs/ice-cream-business-tips-tricks",
    sourceKind: "rss",
    itemTitle: "How Ice Cream Chases Away the Blues",
    itemSummary:
      "Is Ice Cream The Ultimate Cure For The Blues? If you’ve already booked your summer gelato tour of Italy or you're passionate about whipping up delectable scoops of ice cream with quality ingredients like pure Madagascar bourbon vanilla",
    itemContentText:
      "Is Ice Cream The Ultimate Cure For The Blues? If you’ve already booked your summer gelato tour of Italy or you're passionate about whipping up delectable scoops of ice cream with quality ingredients like pure Madagascar bourbon vanilla extract, rich chocolate, or smooth coconut cream, you probably instinctively know that this frozen delight has an ability to lift you to cloud nine with just one bite. If you're curious about the science of it all, however, take note. A",
    itemUrl:
      "https://icecreamuniversity.org/blogs/ice-cream-business-tips-tricks/how-ice-cream-chases-away-the-blues",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-72643d0f",
    source: "stored",
    feedTitle: "Blog - GATHER Events",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.gatherevents.com/gatherblog?format=rss",
    feedSiteUrl: "https://www.gatherevents.com/gatherblog/",
    sourceKind: "rss",
    itemTitle: "Moody Mexican Beach Wedding at Hotel Panamera",
    itemSummary:
      "Lindsey and Tyler's intimate destination wedding unfolded against the stunning backdrop of Tulum's pristine beach at Hotel Panamera, where the soft sound of waves set a romantic tone. Surrounded by their closest friends and family, the",
    itemContentText:
      "Lindsey and Tyler's intimate destination wedding unfolded against the stunning backdrop of Tulum's pristine beach at Hotel Panamera, where the soft sound of waves set a romantic tone. Surrounded by their closest friends and family, the couple exchanged vows under a canopy adorned with vibrant tropical flowers, reflecting moody colors that complemented the serene sunset and local environ. The air was filled with the enticing aromas of delicious Mexican fare, inviting guests",
    itemUrl:
      "https://www.gatherevents.com/gatherblog/moody-mexican-beach-wedding-at-hotel-panamera",
    expected: [],
    needsReview: true,
    note: "Destination wedding feature; none vs Food & Travel",
  },
  {
    id: "stored-72681c4c",
    source: "stored",
    feedTitle: "Miss Behavior - Coaching for Families and Dogs - Blog",
    feedDescription: "Blog",
    feedUrl: "https://missbehaviortraining.com/blog.html/feed",
    feedSiteUrl: "http://missbehaviortraining.com/blog",
    sourceKind: "rss",
    itemTitle: "From Dominant to Dramatic: How to use your W.O.R.D.S to describe behavior",
    itemSummary:
      "What we call our dogs matters more than we think. Here's why shifting from judgment to observation can make all the difference—for your dog, your community, and the families we’re trying to help.Let’s just say it—most of us have been",
    itemContentText:
      "What we call our dogs matters more than we think. Here's why shifting from judgment to observation can make all the difference—for your dog, your community, and the families we’re trying to help. Let’s just say it—most of us have been there. You’re tired. You’re frustrated. You’ve said the same cue seventeen times. And out comes something like: “He’s being dominant.” “She’s just dramatic.” “He’s such a jerk sometimes.” I’ve said it too. More than once. But here’s something I",
    itemUrl: "http://missbehaviortraining.com/blog/words",
    expected: [],
    needsReview: true,
    note: "Dog behavior/training; no fitting label",
  },
  {
    id: "stored-72c17feb",
    source: "stored",
    feedTitle: "Abou Conde's Blog",
    feedDescription: "Cloud and Infra Security",
    feedUrl: "https://abouconde.com/feed",
    feedSiteUrl: "https://abouconde.com/",
    sourceKind: "rss",
    itemTitle: "🧭 Understanding Pending Dispositions in Microsoft Purview Records Management",
    itemSummary:
      "🎯 Introduction In today’s data-driven organizations, managing the full lifecycle of information is critical — not just for efficiency, but for compliance and risk reduction.Microsoft Purview Records Management enables organizations to",
    itemContentText:
      "Introduction In today’s data-driven organizations, managing the full lifecycle of information is critical — not just for efficiency, but for compliance and risk reduction. Microsoft Purview Records Management enables organizations to automate how content is classified, retained, and permanently disposed of — in line with legal, regulatory, and business requirements. One key feature within this capability is Pending Dispositions — the final checkpoint before data is",
    itemUrl:
      "https://abouconde.com/2025/10/31/%f0%9f%a7%ad-understanding-pending-dispositions-in-microsoft-purview-records-management/",
    expected: ["Technology"],
    needsReview: true,
    note: "Microsoft Purview admin; Technology vs Software Engineering/Security",
  },
  {
    id: "stored-72dfc699",
    source: "stored",
    feedTitle: "Aeliya Marine Tech - Updates",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://aeliyamarinetech.com/blogs/updates.atom",
    feedSiteUrl: "https://aeliyamarinetech.com/blogs/updates",
    sourceKind: "rss",
    itemTitle:
      "ABB ACW6441390600000300900 ACS600 Multidrive Module – Specifications, Features & Applications",
    itemSummary:
      "✓ 30-Day Warranty | ✓ Free Shipping View Product The ABB ACW6441390600000300900 ACS600 Multidrive Module is a high-capacity industrial drive solution that features an advanced dual-component architecture integrating both the Ngdr-03C gate",
    itemContentText:
      "✓ 30-Day Warranty | ✓ Free Shipping View Product The ABB ACW6441390600000300900 ACS600 Multidrive Module is a high-capacity industrial drive solution that features an advanced dual-component architecture integrating both the Ngdr-03C gate driver and Nxpp-03C control component . This powerful variable frequency drive module delivers an exceptional 4300A/1156A output current with precise frequency control from 0 to 300 Hz, establishing it as a premier choice for the most",
    itemUrl:
      "https://aeliyamarinetech.com/blogs/updates/abb-acw6441390600000300900-acs600-multidrive-module",
    expected: [],
  },
  {
    id: "stored-73ccc406",
    source: "stored",
    feedTitle: "Energi People",
    feedDescription: "Construction Engineering Jobs",
    feedUrl: "https://energipeople.com/feed",
    feedSiteUrl: "https://energipeople.com/",
    sourceKind: "rss",
    itemTitle: "UAE MEP Design Market Overview & Salary Guide 2024",
    itemSummary:
      "Energi People, in partnership with CIBSE UAE are delighted to present our highly anticipated, 2022 UAE MEP Design Salary guide & market insights, including some amazing must read updates & news from CIBSE UAE, CIBSE YEN UAE & WiBSE: Women",
    itemContentText:
      "Welcome to the 2024 UK MEP Design Market Overview and Salary Guide! Looking back, the construction industry has grown, despite predictions, bringing exciting projects but also challenges in finding skilled professionals. Key Challenges: Shortage of Skilled Talent: Delayed projects, higher labor costs, and pressure to find and keep qualified engineers. Global Supply Chain Issues: Delays in materials and increased construction costs affecting budgets and timelines. New",
    itemUrl: "https://energipeople.com/uae-mep-design-market-overview-salary-guide-2024/",
    expected: ["Education & Work", "Business & Startups"],
  },
  {
    id: "stored-740d7d94",
    source: "stored",
    feedTitle: "DZone JavaScript Zone",
    feedDescription: "Recent posts in JavaScript on DZone.com",
    feedUrl: "https://feeds.dzone.com/javascript",
    feedSiteUrl: "https://dzone.com/javascript",
    sourceKind: "rss",
    itemTitle: "How We Cut PyFlink Pipeline p99 Latency from 3-5 Seconds to ~500ms",
    itemSummary:
      "The Problem: Our p99 Was 3-5 Seconds Our PyFlink pipeline was missing its latency SLO by seconds. The pipeline itself was straightforward: consume events from Kafka, transform them, serialize them as Protobuf, and write the results to",
    itemContentText:
      "The Problem: Our p99 Was 3-5 Seconds Our PyFlink pipeline was missing its latency SLO by seconds. The pipeline itself was straightforward: consume events from Kafka, transform them, serialize them as Protobuf, and write the results to downstream systems. Yet under production load, p99 end-to-end latency was consistently in the 3-5 second range. Profiling pointed us to an unexpected bottleneck: we were deserializing Protobuf messages in Python , even though the Flink runtime",
    itemUrl:
      "https://feeds.dzone.com/link/23564/17405181/how-we-got-pyflink-under-half-a-second-of-end-to-e",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-744a3762",
    source: "stored",
    feedTitle: "The Drone Girl",
    feedDescription:
      "If you're interested in the evolution of drones and their uses, and you want a fresh, professional outlook on the industry, check out Sally's blog. Drone Girl is run by Sally French, a journalist and",
    feedUrl: "https://www.thedronegirl.com/feed",
    feedSiteUrl: "https://www.thedronegirl.com/",
    sourceKind: "rss",
    itemTitle: "Amelia Dronehart is back(!), offering connections for women in the drone industry",
    itemSummary:
      "When I first got my start in the drone industry well over a decade ago, I was almost always the only woman in the room, whether that was a drone conference, flight field or other industry meetup. Unsurprisingly, it often felt a little",
    itemContentText:
      "When I first got my start in the drone industry well over a decade ago, I was almost always the only woman in the room, whether that was a drone conference, flight field or other industry meetup. Unsurprisingly, it often felt a little lonely. That’s why the creation of drone women’s group Amelia Dronehart back in those early days was such a game-changer for me — any many others like me spread around the world. Founded by Rhianna Lakin, Amelia Dronehart was primarily a",
    itemUrl:
      "https://www.thedronegirl.com/2026/09/03/amelia-dronehart-relaunch-kara-murphy-women-in-drones/",
    expected: ["Technology"],
    needsReview: true,
    note: "Women-in-drones community; technology vs work",
  },
  {
    id: "stored-746e729a",
    source: "stored",
    feedTitle: "The Architect Elevator",
    feedDescription:
      "Modern architects look beyond UML and design patterns to transform IT by connecting the strategy 'penthouse' with the technology 'engine room'. They ride the Architect Elevator.",
    feedUrl: "https://architectelevator.com/feed.xml",
    feedSiteUrl: "https://architectelevator.com/feed.xml",
    sourceKind: "rss",
    itemTitle: "The digital grass isn’t greener. It isn’t grass.",
    itemSummary: "Don't project your constraints onto others who work differently.",
    itemContentText:
      "Updated: February 27, 2026 Category: Transformation Not many people switch straight from a Silicon Valley powerhouse to a global insurance firm based in Germany. Now I am not sure whether that makes me brave or foolish, but it gives me a rare perspective on the life of architects at two far ends of the spectrum. Most employees of traditional companies only know the other side from what I call “digital travel brochures”, which show the digital equivalent of endless, isolated,",
    itemUrl: "https://architectelevator.com/transformation/digital-grass-greener/",
    expected: ["Business & Startups"],
    needsReview: true,
    note: "Corporate work-culture essay; business vs work vs personal",
  },
  {
    id: "stored-74cce0c6",
    source: "stored",
    feedTitle: "Melody Jacob",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.melodyjacob.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://www.melodyjacob.com/",
    sourceKind: "rss",
    itemTitle: "Tannoch Loch, Milngavie: A Little Detour Before Home",
    itemSummary:
      "After leaving Mugdock Country Park and Craigend Castle , we drove over to Easterton Farm Park because of a little boy we had met earlier. He was riding a horse when he noticed how excited I was to see it and kindly asked if I wanted to pet",
    itemContentText:
      "After leaving Mugdock Country Park and Craigend Castle , we drove over to Easterton Farm Park because of a little boy we had met earlier. He was riding a horse when he noticed how excited I was to see it and kindly asked if I wanted to pet it. Of course I said yes. While I was petting the horse, he told us about a nearby stable where people can learn how to ride, although the horse he was riding actually belonged to his friend. He was such a lovely little guy. We decided to",
    itemUrl: "https://www.melodyjacob.com/2026/08/tannoch-loch-milngavie.html",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-74e8ddf5",
    source: "stored",
    feedTitle: "Ginger Snaps",
    feedDescription: "Tidbits and treats for teachers",
    feedUrl: "http://gingersnapstreatsforteachers.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://gingersnapstreatsforteachers.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Pace Out Your Year Like a Boss {Free Pacing Guide Template Included}",
    itemSummary:
      "You guys know I LOVE me some planning. I get soooo excited at the end of every year for the prospect of planning for a new year. This coming year was extra exciting because I got to plan and pace for a whole new grade level and content",
    itemContentText:
      "You guys know I LOVE me some planning. I get soooo excited at the end of every year for the prospect of planning for a new year. This coming year was extra exciting because I got to plan and pace for a whole new grade level and content area. I relished EVERY minute of it. I spent a lot of time working on this pacing guide for the upcoming year, but there are a few key things you need to keep in mind when you start to pace out your year. YOUR DISTRICT EMPLOYEE CALENDAR This",
    itemUrl:
      "http://gingersnapstreatsforteachers.blogspot.com/2019/08/pace-out-your-year-like-boss-free.html",
    expected: ["Education & Work"],
  },
  {
    id: "stored-762c45b2",
    source: "stored",
    feedTitle: "Inside World Football",
    feedDescription: "For the Business of Football",
    feedUrl: "https://www.insideworldfootball.com/feed",
    feedSiteUrl: "https://www.insideworldfootball.com/",
    sourceKind: "rss",
    itemTitle: "Globo, ESPN and Amazon carve up Brazilian Cups in $800m+ deal",
    itemSummary:
      "September 14 – The rights to Brazil’s Copa do Brasil and the Supercopa Rei will be shared by Globo, ESPN and Amazon’s Prime Video for the next four-year cycle, in what the CBF calls “the largest rights deal in the history of Brazilian",
    itemContentText:
      "September 14 – The rights to Brazil’s Copa do Brasil and the Supercopa Rei will be shared by Globo, ESPN and Amazon’s Prime Video for the next four-year cycle, in what the CBF calls “the largest rights deal in the history of Brazilian football.” Running from 2027 through 2030, the three broadcasters will collectively pay up to BR$1.08 billion ($211.4 million) a year, more than BR$4 billion across the contract. Globo took the free-to-air package of at least 14 national games",
    itemUrl:
      "https://www.insideworldfootball.com/2026/09/14/globo-espn-and-amazon-carve-up-brazilian-cups-in-800m-deal/",
    expected: ["Sports", "Business & Startups"],
  },
  {
    id: "stored-7658203c",
    source: "stored",
    feedTitle: "Power & Utilities – AWS for Industries",
    feedDescription: "Just another Amazon Web Services site",
    feedUrl: "https://aws.amazon.com/blogs/industries/category/industries/power-and-utilities/feed",
    feedSiteUrl: "https://aws.amazon.com/blogs/industries/",
    sourceKind: "rss",
    itemTitle:
      "Serverless self-service portal for running engineering applications with on-premises software licensing",
    itemSummary:
      "Background: Energy companies are seeking methods to run engineering software in the cloud, especially those that need a significant amount of computing and storage resources in short periods of time to bring about simulation capacity",
    itemContentText:
      "Background: Energy companies are seeking methods to run engineering software in the cloud, especially those that need a significant amount of computing and storage resources in short periods of time to bring about simulation capacity instantaneously and reduce project turnaround (for example, Florida-based utility runs PROMOD, Siemens Simcenter customers run CFD , Ansys LS-DYNA customers run FEA on AWS). Driven by the goal of cost reduction and operational excellence, a",
    itemUrl:
      "https://aws.amazon.com/blogs/industries/serverless-self-service-portal-for-running-engineering-applications-with-on-premises-software-licensing/",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-76922cea",
    source: "stored",
    feedTitle: "Australian Academy of Interior Design Blog",
    feedDescription:
      "The Australian Academy of Interior Design is a leading provider of home study and classroom-based interior design courses in Australia.",
    feedUrl: "https://www.aaid.edu.au/feed",
    feedSiteUrl: "https://www.aaid.edu.au/blogs",
    sourceKind: "rss",
    itemTitle: "How to design gender-neutral bedrooms for children",
    itemSummary:
      "When major retailer John Lewis announced they were no longer going to have separate clothing sections for boys and girls, opting instead for a single “Boys and Girls” section, I wasn’t surprised.",
    itemContentText:
      "When major retailer John Lewis announced they were no longer going to have separate clothing sections for boys and girls, opting instead for a single “Boys and Girls” section, I wasn’t surprised.",
    itemUrl: "https://www.aaid.edu.au/blog/how-to-design-gender-neutral-bedrooms-for-children",
    expected: ["Design & UX"],
  },
  {
    id: "stored-77ffd94f",
    source: "stored",
    feedTitle: "Quad Cities Design",
    feedDescription: "Prescott AZ Web Design",
    feedUrl: "https://quadcitiesdesign.com/feed",
    feedSiteUrl: "https://quadcitiesdesign.com/",
    sourceKind: "rss",
    itemTitle: "Why You Rank #1 and Still Get Zero Calls",
    itemSummary:
      "Quad Cities Design Why You Rank #1 and Still Get Zero Calls Ranking #1 on Google doesn’t mean the phone rings. See why Prescott home service businesses rank well but still miss calls, and the exact fixes that work. The post Why You Rank #1",
    itemContentText:
      "Quad Cities Design Why You Rank #1 and Still Get Zero Calls You rank #1 for your main service in Prescott, and the phone still isn’t ringing. When you rank #1 and still get zero calls, the real issue is almost always what happens after the click, not the ranking itself. Ranking and Getting Calls Are Two Different Jobs Most Prescott business owners assume the two travel together. Rank higher, get more calls, simple as that. It feels like the obvious math, so when it doesn’t",
    itemUrl: "https://quadcitiesdesign.com/blog/why-you-rank-1-and-still-get-zero-calls/",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-78bd4c92",
    source: "stored",
    feedTitle: "TechGliding - Tech From The Top",
    feedDescription:
      "TechGliding is a technology website where you can read more and more awesome articles on tech, apps, business, marketing, etc. We want you to look at the Tech From the Top!",
    feedUrl: "https://www.techgliding.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://www.techgliding.com/",
    sourceKind: "rss",
    itemTitle: "Smarter Automation for a Smarter Chip: The Future of Wafer Handling",
    itemSummary:
      "Accuracy, velocity, and dependability are all key to semiconductor manufacturing. Bigger, better, and quicker chips are always in growing demand, and more intelligent automation technologies are also needed to go with it. From wafer fab to",
    itemContentText:
      "Accuracy, velocity, and dependability are all key to semiconductor manufacturing. Bigger, better, and quicker chips are always in growing demand, and more intelligent automation technologies are also needed to go with it. From wafer fab to packaging, each phase of the semiconductor process employs advanced automation systems to ensure it functions effectively and defect-free. Underlying this change is one of the most critical innovations in the field — the Wafer Handling End",
    itemUrl: "https://www.techgliding.com/2025/11/smarter-automation-for-smarter-chip.html",
    expected: ["Technology"],
  },
  {
    id: "stored-796377db",
    source: "stored",
    feedTitle: "Software Engineering",
    feedDescription: "Web development",
    feedUrl: "https://damienbod.com/feed",
    feedSiteUrl: "https://damienbod.com/",
    sourceKind: "rss",
    itemTitle:
      "Using multiline Parameters for Aspire and ASP.NET Core with user secrets and Azure default deployments",
    itemSummary:
      "Multiple line secrets or configuration do not work in Aspire per default. An example of this is using a PEM file for certificates. This posts shows how the multiple line configuration parameters can be setup in Aspire, ASP.NET Core and",
    itemContentText:
      "Multiple line secrets or configuration do not work in Aspire per default. An example of this is using a PEM file for certificates. This posts shows how the multiple line configuration parameters can be setup in Aspire, ASP.NET Core and works with user secrets and Azure default deployments. Code: https://github.com/swiss-ssi-group/swiyu-passkeys-idp-loi-loa Adding an base64 encoding layer To workaround this Aspire bug, we can add a base64 encoding layer between the Aspire",
    itemUrl:
      "https://damienbod.com/2026/09/01/using-multiline-parameters-for-aspire-and-asp-net-core-with-user-secrets-and-azure-default-deployments/",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-799a739e",
    source: "stored",
    feedTitle: "Muaythai-World.com",
    feedDescription: "Muay Thai. MMA. Kickboxing.",
    feedUrl: "https://muaythai-world.com/feed",
    feedSiteUrl: "https://muaythai-world.com/",
    sourceKind: "rss",
    itemTitle: "Phetch Buncha Stadium, Chaweng Beach Koh Samui",
    itemSummary:
      "On Koh Samui there are three notable Muay Thai hotspots. The Petch Buncha Stadium is probably the most famous beside the Chaweng Stadium. There are regular top-fights at highest level and great entertainment is guaranteed. General",
    itemContentText:
      "On Koh Samui there are three notable Muay Thai hotspots. The Petch Buncha Stadium is probably the most famous beside the Chaweng Stadium. There are regular top-fights at highest level and great entertainment is guaranteed. General Information Phetch Buncha Boxing Stadium Chaweng, Koh Samui Address: Petch Buncha Samui Boxing Ring, Chaweng Choengmon Road, Chaweng, Koh [...] Der Beitrag Phetch Buncha Stadium, Chaweng Beach Koh Samui erschien zuerst auf Muaythai-World.com .",
    itemUrl: "https://muaythai-world.com/petch-buncha-stadium-chaweng-beach-koh-samui/",
    expected: ["Sports", "Food & Travel"],
  },
  {
    id: "stored-7b065664",
    source: "stored",
    feedTitle: "Dynamic Transit Co.",
    feedDescription: "Family-Owned Trucking Company in St. Louis, MO",
    feedUrl: "https://dynamictransit.com/feed",
    feedSiteUrl: "https://dynamictransit.com/",
    sourceKind: "rss",
    itemTitle:
      "Dynamic Transit Expands Fleet with 100 New 2025 Peterbilt 579 Trucks Featuring Safety, Cutting-Edge Technology Performance, and Sustainability Advancements",
    itemSummary:
      "ST. LOUIS – Apr. 4, 2025 – Dynamic Transit Fleet Expansion continues in 2025 with the addition of 100 new Peterbilt 579 trucks, reinforcing our commitment to safety, driver comfort, and sustainability. These new trucks are equipped with",
    itemContentText:
      "ST. LOUIS – Apr. 4, 2025 – Dynamic Transit Fleet Expansion continues in 2025 with the addition of 100 new Peterbilt 579 trucks, reinforcing our commitment to safety, driver comfort, and sustainability. These new trucks are equipped with cutting-edge technology, improving both the driving experience and customer service. “The industry and world are changing, and […] The post Dynamic Transit Expands Fleet with 100 New 2025 Peterbilt 579 Trucks Featuring Safety, Cutting-Edge",
    itemUrl:
      "https://dynamictransit.com/blog/dynamic-transit-expands-fleet-with-100-new-2025-peterbilt-579-trucks-featuring-safety-cutting-edge-technology-performance-and-sustainability-advancements/",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-7bacf34d",
    source: "stored",
    feedTitle: "Network World",
    feedDescription: "From the data center to the edge",
    feedUrl: "https://www.networkworld.com/feed",
    feedSiteUrl: "https://www.networkworld.com/",
    sourceKind: "rss",
    itemTitle: "Arista warns customers ahead of next week’s security disclosures",
    itemSummary:
      "Arista Networks has taken the unusual step of warning customers that next week, it will release multiple security advisories affecting Arista EOS and VeloCloud . AI-driven changes to its vulnerability detection processes have resulted in a",
    itemContentText:
      "Arista Networks has taken the unusual step of warning customers that next week, it will release multiple security advisories affecting Arista EOS and VeloCloud . AI-driven changes to its vulnerability detection processes have resulted in a higher-than-usual volume of security updates, the company says, and the advance notification is aimed at helping its customers plan. “We’re pre-announcing this, ahead of the detailed disclosures, so your teams have a heads-up. For at least",
    itemUrl:
      "https://www.networkworld.com/article/4217638/arista-warns-customers-ahead-of-next-weeks-security-disclosures.html",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-7c22be25",
    source: "stored",
    feedTitle: "Spectro Cloud Feed",
    feedDescription:
      "Discover our blogs about all things Kubernetes. From bare metal to edge, learn tips and tricks for getting the most out of K8s at scale.",
    feedUrl: "https://www.spectrocloud.com/blog/rss.xml",
    feedSiteUrl: "https://www.spectrocloud.com/",
    sourceKind: "rss",
    itemTitle: "Choosing the right Kubernetes monitoring stack in 2026 - Spectro Cloud",
    itemSummary:
      "Build the right Kubernetes monitoring stack from Prometheus, Grafana, OTel, and eBPF to managed backends. Choose the right tools, cut costs, and boost observability.",
    itemContentText:
      "Build the right Kubernetes monitoring stack from Prometheus, Grafana, OTel, and eBPF to managed backends. Choose the right tools, cut costs, and boost observability.",
    itemUrl: "https://www.spectrocloud.com/blog/choosing-the-right-kubernetes-monitoring-stack",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-7c5bd0ea",
    source: "stored",
    feedTitle: "B-E-Y toys - News",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://beytoys.com/blogs/news.atom",
    feedSiteUrl: "https://beytoys.com/blogs/news",
    sourceKind: "rss",
    itemTitle: "Watch Beyblade Anime Online: Top Platforms to Catch All the Action!",
    itemSummary:
      "Where to Watch Beyblade Anime Online for Free – Full Episodes Available! Looking to watch Beyblade anime online? We’ve got you covered! Discover the best platforms where you can stream your favorite Beyblade series for free. From Beyblade",
    itemContentText:
      "If you're a Beyblade fan, you're probably always on the lookout for the best places to watch the latest episodes of your favorite series online. With so many exciting Beyblade anime titles spanning across multiple generations, it can be a challenge to keep track of where to watch them. Whether you’re a long-time fan of the original 2001 series or you’re hooked on the new Beyblade Burst saga, you’ll be happy to know that there are several free and easy-to-access platforms",
    itemUrl:
      "https://beytoys.com/blogs/news/watch-beyblade-anime-online-top-platforms-to-catch-all-the-action",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-7c78cd1a",
    source: "stored",
    feedTitle: "Maps4Kids",
    feedDescription: "A world of experiences",
    feedUrl: "https://maps4kids.com/blog/feed",
    feedSiteUrl: "https://maps4kids.com/blog/",
    sourceKind: "rss",
    itemTitle: "Discovery of a Pharaoh’s Tomb : Mysteries in Abydos",
    itemSummary:
      "Introduction to Ancient Egypt Imagine a land of towering pyramids, golden treasures, and powerful kings and queens. This is ancient Egypt, a civilization that flourished along the Nile River thousands of years ago. The Egyptians built",
    itemContentText:
      "Introduction to Ancient Egypt Imagine a land of towering pyramids, golden treasures, and powerful kings and queens. This is ancient Egypt, a civilization that flourished along the Nile River thousands of years ago. The Egyptians built incredible monuments and believed in a rich tapestry of gods and goddesses. Their culture continues to fascinate people around […] The post Discovery of a Pharaoh’s Tomb : Mysteries in Abydos appeared first on Maps4Kids .",
    itemUrl: "https://maps4kids.com/blog/discovery-of-a-pharaohs-tomb/",
    expected: ["Science & Research"],
  },
  {
    id: "stored-7ea70f46",
    source: "stored",
    feedTitle: "Tabletop Fix",
    feedDescription: "Unofficial - Independent - Non-Commercial",
    feedUrl: "http://ttfix.blogspot.com/feeds/posts/default",
    feedSiteUrl: "http://www.blogger.com/feeds/3685013891999261791/posts/default",
    sourceKind: "rss",
    itemTitle: "The Printer's Apprentice - Kickstarter Ending Soon",
    itemSummary:
      "The Beauty and Darkness Kickstarter is ending soon: Link: Campaign on Kickstarter",
    itemContentText:
      "The Beauty and Darkness Kickstarter is ending soon: Link: Campaign on Kickstarter",
    itemUrl: "http://www.blogger.com/feeds/3685013891999261791/posts/default/4006681555097055772",
    expected: ["Culture & Media"],
    needsReview: true,
    note: "Thin Kickstarter notice for tabletop game",
  },
  {
    id: "stored-7ee16c58",
    source: "stored",
    feedTitle: "Guardian Small Business Network | The Guardian",
    feedDescription:
      "Latest Guardian Small Business Network news, comment and analysis from the Guardian, the world's leading liberal voice",
    feedUrl: "https://www.theguardian.com/small-business-network/rss",
    feedSiteUrl: "https://www.theguardian.com/small-business-network",
    sourceKind: "rss",
    itemTitle: "Ask the experts: how can your business stand out in a crowded market?",
    itemSummary:
      "Join us on this page from 1-2pm on Thursday 26 April to quiz our expert panel on how to develop a unique selling point for your brand A commenter has asked how she can cut through the noise of other crowdfunding campaigns to find",
    itemContentText:
      "Join us on this page from 1-2pm on Thursday 26 April to quiz our expert panel on how to develop a unique selling point for your brand A commenter has asked how she can cut through the noise of other crowdfunding campaigns to find investment for her business Luke Lang, founder of Crowdcube gives his advice on what he’s seen work best for crowdfunding campaigns: Continue reading...",
    itemUrl:
      "https://www.theguardian.com/small-business-network/live/2018/apr/18/ask-the-experts-find-the-right-usp-crowded-market",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-7f4e8843",
    source: "stored",
    feedTitle: "Puppets Occupy Street Festival",
    feedDescription: "25 August - 01 September",
    feedUrl: "https://puppetsoccupystreet.blogspot.com/feeds/posts/default?alt\\x3drss\\x22",
    feedSiteUrl: "https://www.blogger.com/feeds/2807622401229629236/posts/default",
    sourceKind: "rss",
    itemTitle: "„Hocus Pocus” şi revine la Festivalul „Puppets Occupy Street”: Star Show (Galați)",
    itemSummary:
      "PUPPETS PLAY Doi actori talentaţi: Aurelian Iorga şi Andrei Ciugulea. Nişte copii cu poftă de poveşti – viitori magicieni, mari şi mici. Şi o istorioară foarte îndrăgită, cu personaje... din 2020: Scufiţa Roşie cu Facebook şi Instagram,",
    itemContentText:
      "PUPPETS PLAY Doi actori talentaţi: Aurelian Iorga şi Andrei Ciugulea. Nişte copii cu poftă de poveşti – viitori magicieni, mari şi mici. Şi o istorioară foarte îndrăgită, cu personaje... din 2020: Scufiţa Roşie cu Facebook şi Instagram, Bunica cu Yahoo Messenger, share location şi TikTok, un Lup care face selfie-uri! Ce au toate în comun? Trupa Star Show, din Galaţi! Reprezentaţia sa, intitulată „Hocus Pocus” – a treia şi ultima din cadrul Festivalului „Puppets Occupy",
    itemUrl: "https://www.blogger.com/feeds/2807622401229629236/posts/default/7766717626350522338",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-7f75037d",
    source: "stored",
    feedTitle: "AWS Security Blog",
    feedDescription:
      "The latest AWS security, identity, and compliance launches, announcements, and how-to posts.",
    feedUrl: "https://aws.amazon.com/blogs/security/feed",
    feedSiteUrl: "https://aws.amazon.com/blogs/security/",
    sourceKind: "rss",
    itemTitle: "Agentic security: Detection and response at machine speed",
    itemSummary:
      "After talking with enterprise security leaders over the past year, one thing has become clear: the rise of autonomous AI agents is the most significant shift in security posture since the move to cloud. Organizations across every industry",
    itemContentText:
      "After talking with enterprise security leaders over the past year, one thing has become clear: the rise of autonomous AI agents is the most significant shift in security posture since the move to cloud. Organizations across every industry are adopting AI agents that authenticate on behalf of users, execute multistep workflows, and make decisions across infrastructure, often without waiting for human approval. Security operations need to keep pace. At Amazon Web Services",
    itemUrl:
      "https://aws.amazon.com/blogs/security/agentic-security-detection-and-response-at-machine-speed/",
    expected: ["Security & Privacy", "AI & ML"],
  },
  {
    id: "stored-7f793105",
    source: "stored",
    feedTitle: "Miami Family Law Blog | Streets Law",
    feedDescription: "Miami family law attorney blog",
    feedUrl: "https://www.streetslaw.com/blog?format=rss",
    feedSiteUrl: "https://www.streetslaw.com/blog/",
    sourceKind: "rss",
    itemTitle:
      'Florida domestic violence injunctions: Courts are not designed "to manage ongoing personal relationships"',
    itemSummary:
      "Posted by Nydia Streets of Streets Law in Florida Domestic Violence According to Florida law, “Stalking” occurs when a person “willfully, maliciously, and repeatedly follows, harasses, or cyberstalks another person.” § 784.048(2), Fla.",
    itemContentText:
      "Posted by Nydia Streets of Streets Law in Florida Domestic Violence According to Florida law, “Stalking” occurs when a person “willfully, maliciously, and repeatedly follows, harasses, or cyberstalks another person.” § 784.048(2), Fla. Stat. (2024). “Harass” is defined by the statutes as engaging in a course of conduct directed at a specific person that: 1. Causes substantial emotional distress; and 2. Serves no legitimate purpose. This was an issue in the case Carvajal v.",
    itemUrl:
      "https://www.streetslaw.com/blog/2026/5/5/florida-domestic-violence-injunctions-courts-are-not-designed-to-manage-ongoing-personal-relationships",
    expected: ["Politics & Policy"],
  },
  {
    id: "stored-7fc805c0",
    source: "stored",
    feedTitle: "Baden Sports Canada - Baden Sports Blog",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://badensports.ca/blogs/news.atom",
    feedSiteUrl: "https://badensports.ca/blogs/news",
    sourceKind: "rss",
    itemTitle: "Summer Essentials: Baden's Summer Best Sellers",
    itemSummary:
      "Whether you’re gearing up for a beach volleyball game, hosting a BBQ in the park or your backyard, or honing in on a new skill, our current best sellers are sure to meet your needs. Let’s take a closer look at some of our stand out",
    itemContentText:
      "As the summer sun brings outdoor adventures and sports activities, ensuring you have the right equipment can make all the difference between a good time and a great one. Whether you’re gearing up for a beach volleyball game, hosting a BBQ in the park or your backyard, or honing a new skill, our current best sellers are sure to meet your needs. Let’s take a closer look at some of our standout products that are perfect for this summer season. 1. Champions Volleyball &",
    itemUrl: "https://badensports.ca/blogs/news/summer-essentials-badens-current-best-sellers",
    expected: [],
    needsReview: true,
    note: "Sports gear best-seller product listing",
  },
  {
    id: "stored-80bfed3f",
    source: "stored",
    feedTitle: "Street Muscle Magazine",
    feedDescription:
      "Street Muscle Magazine is the Internet's most popular all-digital magazine for the muscle car enthusiast, providing the latest in up-to-date industry news, nationwide event coverage, and technical",
    feedUrl: "https://www.streetmusclemag.com/feed",
    feedSiteUrl: "https://www.streetmusclemag.com/",
    sourceKind: "rss",
    itemTitle: "Pro Touring Floater Kit: Strange Engineering’s Axle Saver",
    itemSummary:
      "Strange Engineering's Pro Touring Floater Kit swaps flanged axles for a full-floating hub design that boosts strength and safety.",
    itemContentText:
      "Strange Engineering's Pro Touring Floater Kit swaps flanged axles for a full-floating hub design that boosts strength and safety.",
    itemUrl:
      "https://www.streetmusclemag.com/tech-stories/pro-touring-floater-kit-strange-engineerings-axle-saver/",
    expected: [],
    needsReview: true,
    note: "Automotive parts product piece; hobby, no clear label",
  },
  {
    id: "stored-80e5f371",
    source: "stored",
    feedTitle: "12th Man Rising Feed",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://12thmanrising.com/feed",
    feedSiteUrl: "https://12thmanrising.com/",
    sourceKind: "rss",
    itemTitle: "4 gut reactions from Seahawks' stunning Week 1 comeback vs. Patriots",
    itemSummary:
      "The Seattle Seahawks defeated the New England Patriots in Week 1, and here are some takeaways from the come-from-behind victory.",
    itemContentText:
      "The Seattle Seahawks defeated the New England Patriots in Week 1, and here are some takeaways from the come-from-behind victory.",
    itemUrl:
      "https://12thmanrising.com/gut-reactions-from-seahawks-stunning-week-1-comeback-vs-patriots?utm_source=RSS",
    expected: ["Sports"],
  },
  {
    id: "stored-8106abf4",
    source: "stored",
    feedTitle: "Retro Hour Podcast",
    feedDescription: "Your Weekly Retro Gaming & Technology Podcast",
    feedUrl: "https://theretrohour.com/feed",
    feedSiteUrl: "https://theretrohour.com/",
    sourceKind: "rss",
    itemTitle: "Amiga Just Revealed Its Future Plans – The Retro Hour EP544",
    itemSummary:
      "Amiga's accouncements, live from Kickstart in Derby The post Amiga Just Revealed Its Future Plans – The Retro Hour EP544 appeared first on Retro Hour Podcast .",
    itemContentText:
      "This week, we’re coming to you from Amiga Kickstart in Derby, where we recorded a fascinating panel looking at what comes next for one of computing’s most iconic names. With the long-running legal battle between Hyperion Entertainment and Cloanto finally at an end, the Amiga company took to the stage to discuss the future, its plans for the platform and what this new chapter could mean for the wider Amiga community. After years of courtroom wrangling and uncertainty, could",
    itemUrl: "https://theretrohour.com/amiga-just-revealed-its-future-plans-the-retro-hour-ep544/",
    expected: ["Technology"],
  },
  {
    id: "stored-8112b0a5",
    source: "stored",
    feedTitle: "MSP Blog & Marketing Resources - Technibble",
    feedDescription: "Helping Computer Technicians Become Computer Business Owners",
    feedUrl: "https://www.technibble.com/blog/feed",
    feedSiteUrl: "https://www.technibble.com/blog/",
    sourceKind: "rss",
    itemTitle: "Case Study – How Sending One Newsletter Generated Chris $1728 USD",
    itemSummary:
      "In this case study, we’re going to look at how sending one Technibble White-Label Newsletter generated Chris Carruthers $1728 USD in scheduled work. To introduce Chris, he lives in Ontario in Canada and runs Carruthers Computers. Some of",
    itemContentText:
      "In this case study, we’re going to look at how sending one Technibble White-Label Newsletter generated Chris Carruthers $1728 USD in scheduled work. To introduce Chris, he lives in Ontario in Canada and runs Carruthers Computers. Some of you may already know of him as he is a regular on some computer business related podcasts. Chris’s Challenge Like most […] Source: Case Study – How Sending One Newsletter Generated Chris $1728 USD - Technibble.com",
    itemUrl:
      "https://www.technibble.com/case-study-how-sending-one-newsletter-generated-chris-1728-usd/",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-826ff4e3",
    source: "stored",
    feedTitle: "Daily Wraps Archives - Quantocracy",
    feedDescription: "Quant Blog Mashup",
    feedUrl: "https://quantocracy.com/category/daily-wraps/feed",
    feedSiteUrl: "https://quantocracy.com/category/daily-wraps/",
    sourceKind: "rss",
    itemTitle: "Recent Quant Links from Quantocracy as of 09/08/2026",
    itemSummary:
      "This is a summary of links recently featured on Quantocracy as of Tuesday, 09/08/2026. To see our most recent links, visit the Quant Mashup. Read on readers! The Missing Asset: 120 Years of Global Stocks, Bonds and Gold Through Inflation",
    itemContentText:
      "This is a summary of links recently featured on Quantocracy as of Tuesday, 09/08/2026. To see our most recent links, visit the Quant Mashup . Read on readers! The Missing Asset: 120 Years of Global Stocks, Bonds and Gold Through Inflation Regimes [Beyond Passive] The first two articles in this series measured what one countrys stocks and bonds did over 150 years and found that the country decided most of it. This one holds all sixteen, adds gold, and asks what the",
    itemUrl: "https://quantocracy.com/recent-quant-links-from-quantocracy-as-of-09082026/",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-82a068f2",
    source: "stored",
    feedTitle: "Doctor Of Credit",
    feedDescription: "Bank Account & Credit Card Bonuses",
    feedUrl: "https://feeds.feedburner.com/DoctorOfCredit",
    feedSiteUrl: "https://www.doctorofcredit.com/",
    sourceKind: "rss",
    itemTitle: "[CT only] Mutual Security Credit Union $250 Business Checking Bonus",
    itemSummary:
      "Mutual Security Credit Union is offering a $250 bonus when you open a new business checking account and complete the following requirements",
    itemContentText:
      "Offer at a glance Maximum bonus amount: $250 Availability: You’re eligible for Membership if you: Live, work, worship or attend school in one of these CT counties (Fairfield, Litchfield or New Haven) Are an employee of one of our Select Employer Group companies (see below for list) Have a family member who is already a Member of MSCU Direct deposit required: No Additional requirements: 20 debit card transactions Hard/soft pull: Soft pull ChexSystems: Unknown Credit card",
    itemUrl:
      "https://www.doctorofcredit.com/ct-only-mutual-security-credit-union-250-business-checking-bonus/",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-83934eef",
    source: "stored",
    feedTitle: "scloud by Florian Salzmann",
    feedDescription:
      "Unlock the potential of Microsoft Intune in the modern workplace - explore the cloud with Florian Salzmann's blog!",
    feedUrl: "https://scloud.work/en/rss.xml",
    feedSiteUrl: "https://scloud.work/",
    sourceKind: "rss",
    itemTitle: "Azure MFA: Return of the Hardware Token (OATH TOTP)",
    itemSummary:
      "With a hardware token (OATH TOTP), even users without a smartphone or security key can protect themselves with Azure MFA.",
    itemContentText:
      "With a hardware token (OATH TOTP), even users without a smartphone or security key can protect themselves with Azure MFA.",
    itemUrl: "https://scloud.work/en/azure-mfa-hardware-token-oath-totp/",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-840c60aa",
    source: "stored",
    feedTitle: "Dewey Brinkley Law",
    feedDescription: "Larm Firm in Raleigh",
    feedUrl: "https://www.deweybrinkleylaw.com/feed",
    feedSiteUrl: "https://www.deweybrinkleylaw.com/",
    sourceKind: "rss",
    itemTitle: "Criminal Defense Rights During Police Questioning",
    itemSummary:
      "Police questioning can feel overwhelming. Your heart races. Your mind spins through what you should say. Officers lean in, asking “just a few questions” to “clear things up.” But here’s what you need to know: you have powerful",
    itemContentText:
      "Police questioning can feel overwhelming. Your heart races. Your mind spins through what you should say. Officers lean in, asking “just a few questions” to “clear things up.” But here’s what you need to know: you have powerful constitutional protections for your rights during police questioning, and using them isn’t suspicious, it’s smart. Your Constitutional Rights When Police Ask Questions The moment police want to question you, specific rights kick in. You don’t have to",
    itemUrl: "https://www.deweybrinkleylaw.com/criminal-defense-rights-during-police-questioning/",
    expected: ["Politics & Policy"],
    needsReview: true,
    note: "Law firm explainer on rights; policy vs crime/society",
  },
  {
    id: "stored-84f47847",
    source: "stored",
    feedTitle: "Namaste Postcards",
    feedDescription:
      "I come from a land of thousand Languages, million religions and a billion people...India!!. This blog shows wide varieties of Postcards from round the globe.",
    feedUrl: "https://nagi7.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://nagi7.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "South Korea: Wanggung-ri",
    itemSummary:
      "The Archaeological Site in Wanggung-ri refers to the remains of a Baekje-era palace and temple in Wanggung-ri, Wanggung-myeon, Iksan, South Korea. In 2015, it was made a UNESCO World Heritage Site, as part of the item Baekje Historic",
    itemContentText:
      "The Archaeological Site in Wanggung-ri refers to the remains of a Baekje-era palace and temple in Wanggung-ri, Wanggung-myeon, Iksan, South Korea. In 2015, it was made a UNESCO World Heritage Site, as part of the item Baekje Historic Areas. Thanks to Ms Ainu. Stamp used. Extreme Right- 2010: Saekdongeolgul (Visit Korea). Center- 1991:Korean Mouth Organ.",
    itemUrl: "https://nagi7.blogspot.com/2025/04/south-korea-wanggung-ri.html",
    expected: [],
    needsReview: true,
    note: "Postcard collecting hobby; could be Food & Travel",
  },
  {
    id: "stored-85e53e29",
    source: "stored",
    feedTitle: "Green Evolutions",
    feedDescription: "Swimming Pool Contractors And Water Fountains Builder",
    feedUrl: "https://greenevolutions.com/feed",
    feedSiteUrl: "https://greenevolutions.com/",
    sourceKind: "rss",
    itemTitle: "What El Nino Teaches Us About Natural Swimming Pools in Delhi NCR",
    itemSummary:
      "Why the Heat Wave Makes a Natural Swimming Pool in Delhi NCR More Than an Amenity A natural swimming pool in Delhi NCR this summer is not the same conversation it was even three years ago. El Nino has changed the numbers. June temperatures",
    itemContentText:
      "Why the Heat Wave Makes a Natural Swimming Pool in Delhi NCR More Than an Amenity A natural swimming pool in Delhi NCR this summer is not the same conversation it was even three years ago. El Nino has changed the numbers. June temperatures across Delhi NCR touched 46 degrees this year, and what the forecasts say about the summers ahead is not reassuring. I have been in this work since 1999, building pools and water features in RCC across Northern India, and what I notice now",
    itemUrl: "https://greenevolutions.com/what-el-nino-teaches-us-about/",
    expected: ["Climate & Environment"],
    needsReview: true,
    note: "Pool builder marketing tied to heatwave; Climate vs Design",
  },
  {
    id: "stored-85fef976",
    source: "stored",
    feedTitle: "Pulse Secure Blog",
    feedDescription:
      "Pulse Secure, LLC is a leading provider of access and mobile security solutions to both enterprises and service providers. Enterprises from every vertical and of all sizes utilize the company's Pulse",
    feedUrl: "https://www.ivanti.com/blog/topics/security/rss",
    feedSiteUrl: "https://www.ivanti.com/blog/topics/security",
    sourceKind: "rss",
    itemTitle: "April 2026 Patch Tuesday",
    itemSummary:
      "The lead up to Patch Tuesday has been interesting. We had a Google Chrome zero-day (CVE-2026-5281) that was patched on April 1, an Adobe Acrobat Reader zero-day ( CVE-2026-34621 ) late in the day on Friday April 10, and several older CVEs",
    itemContentText:
      "The lead up to Patch Tuesday has been interesting. We had a Google Chrome zero-day (CVE-2026-5281) that was patched on April 1, an Adobe Acrobat Reader zero-day ( CVE-2026-34621 ) late in the day on Friday April 10, and several older CVEs that were added to the CISA KEV list yesterday ( April 13 ). All of this amidst a lot of industry buzz about Anthropic Mythos and Project Glasswing . What is the correlation between these events and Project Glasswing you ask? Most of the",
    itemUrl: "https://www.ivanti.com/blog/april-2026-patch-tuesday",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-8605249a",
    source: "stored",
    feedTitle: "Blog | West Harrison, OH | Western Hills Heating & Air Conditioning",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://westernhillsheating.com/blog/feed",
    feedSiteUrl: "https://westernhillsheating.com/blog",
    sourceKind: "rss",
    itemTitle: "How to Keep Energy Bills Low This Heating Season in West Harrison, IN",
    itemSummary:
      "Heating your home during winter in West Harrison, IN can lead to higher energy bills, especially if your system isn’t working efficiently. Learning how to keep energy bills low can help you stay comfortable without using more energy than",
    itemContentText:
      "Heating your home during winter in West Harrison, IN can lead to higher energy bills, especially if your system isn’t working efficiently. Learning how to keep energy bills low can help you stay comfortable without using more energy than necessary. A few smart changes can reduce costs and improve your system’s performance all season long.… Continue Reading How to Keep Energy Bills Low This Heating Season in West Harrison, IN The post How to Keep Energy Bills Low This Heating",
    itemUrl:
      "https://westernhillsheating.com/blog/how-to-keep-energy-bills-low-this-heating-season-in-west-harrison-in",
    expected: [],
    needsReview: true,
    note: "HVAC company home-tips post; borderline energy/personal finance",
  },
  {
    id: "stored-86b3e450",
    source: "stored",
    feedTitle: "Groton Hill Music Center",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://grotonhill.org/feed",
    feedSiteUrl: "https://grotonhill.org/",
    sourceKind: "rss",
    itemTitle: "Community Engagement: Fitchburg Students Visit Groton Hill",
    itemSummary:
      "fitchburg students visit groton hill As part of our ongoing partnership with Fitchburg Memorial and Longsjo Middle Schools, we invited string students from both schools to participate in a special workshop and performance right here at",
    itemContentText:
      "fitchburg students visit groton hill As part of our ongoing partnership with Fitchburg Memorial and Longsjo Middle Schools, we invited string students from both schools to participate in a special workshop and performance right here at Groton Hill. The day included a guided tour of the facility, ensemble rehearsals, and a live recording session in […] The post Community Engagement: Fitchburg Students Visit Groton Hill appeared first on Groton Hill Music Center .",
    itemUrl: "https://grotonhill.org/community-engagement-fitchburg-students-visit-groton-hill/",
    expected: ["Culture & Media", "Education & Work"],
    needsReview: true,
    note: "Music center student outreach; Culture vs Education",
  },
  {
    id: "stored-86ce1a0a",
    source: "stored",
    feedTitle: "My RSS Feed",
    feedDescription: "Hot News!",
    feedUrl: "http://www.thenewbookpress.com/blog/files/feed.xml",
    feedSiteUrl: "http://www.thenewbookpress.com/index.html",
    sourceKind: "rss",
    itemTitle: "Shakespeare's Education",
    itemSummary:
      "Just as many students today must read Shakespeare at school, so of course at one time, Shakespeare had to attend school, and read the notes and play writes of that era. This brief but detailed article by noted English actor Simon Callow",
    itemContentText:
      'Just as many students today must read Shakespeare at school, so of course at one time, Shakespeare had to attend school, and read the notes and play writes of that era. This brief but detailed article by noted English actor Simon Callow nicely outlines the educational world and childhood Shakespeare likely experienced. And the schooling did not seem either easy, or particularly broad, as he notes in this passages: " They didn’t study history, they didn’t study mathematics,',
    itemUrl:
      "http://www.thenewbookpress.com/blog/files/ef26164d1545caf1f6172ca142c0a7ff-107.html#unique-entry-id-107",
    expected: ["Education & Work", "Culture & Media"],
    needsReview: true,
    note: "Shakespeare schooling; Education vs Culture ambiguous",
  },
  {
    id: "stored-86e7b067",
    source: "stored",
    feedTitle: "Risk Management",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.trsswealth.com/taxonomy/term/9/feed",
    feedSiteUrl: "https://www.trsswealth.com/",
    sourceKind: "rss",
    itemTitle: "The Estate Plan That Looks Complete on Paper",
    itemSummary:
      "The Estate Plan That Looks Complete on Paper Thomas Brunelle Thu, 05/07/2026 - 08:10",
    itemContentText:
      "Categories Many estate planning failures aren't dramatic. There's no missing will, no family feud, no document anyone forgot to sign. The plan is right there in the drawer. The folder is labeled. The signatures are in place. It just doesn't do what the family thought it would do. That's the version of estate planning that catches people off guard — not the absence of a plan, but the presence of one that quietly stopped working somewhere along the way. Usually because a",
    itemUrl: "https://www.trsswealth.com/blog-01/estate-plan-looks-complete-paper",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-875034ce",
    source: "stored",
    feedTitle: "Energy & Environment Story Archives - West Virginia Public Broadcasting",
    feedDescription: "Telling West Virginia's Story",
    feedUrl: "https://wvpublic.org/category/energy-environment/feed",
    feedSiteUrl: "https://wvpublic.org/category/energy-environment/",
    sourceKind: "rss",
    itemTitle: "Massive Rockslide Blocks WV 3, Traffic Passing Now",
    itemSummary:
      "In the early morning hours on Thursday, a massive rockslide blocked both lanes of West Virginia 3 (WV 3) near the Raleigh County community of Sundial, but the Division of Highways says one lane is back open. The post Massive Rockslide",
    itemContentText:
      "In the early morning hours on Thursday, a massive rockslide blocked both lanes of West Virginia 3 (WV 3) near the Raleigh County community of Sundial, but the Division of Highways says one lane is back open. No injuries have been reported. In photographs, some of the boulders were significantly taller than a man. According to the state resiliency office , the most likely cause of a rockslide is ground saturation due to heavy rains that passed through Tuesday delivering more",
    itemUrl:
      "https://wvpublic.org/story/energy-environment/massive-rockslide-blocks-wv-3-traffic-passing-now/",
    expected: ["World & Society"],
  },
  {
    id: "stored-88e12c34",
    source: "stored",
    feedTitle: "Home - LexBlog",
    feedDescription: "Legal news and opinions that matter",
    feedUrl: "https://www.lexblog.com/site/california-workplace-law-blog/feed",
    feedSiteUrl: "https://www.lexblog.com/",
    sourceKind: "rss",
    itemTitle: "California Executive Order Signals More Scrutiny of AI’s Workplace Impact",
    itemSummary:
      "California Governor Gavin Newsom has issued Executive Order N-6-26, a “first-in-the-nation” order aimed at preparing workers, businesses, and communities for potential workforce disruption associated with artificial intelligence. While the",
    itemContentText:
      "California Governor Gavin Newsom has issued Executive Order N-6-26 , a “first-in-the-nation” order aimed at preparing workers, businesses, and communities for potential workforce disruption associated with artificial intelligence. While the order does not create immediate new compliance obligations for employers, it is an important development for California businesses because it previews where state policy, regulation, and enforcement attention may be headed. The order",
    itemUrl:
      "https://www.lexblog.com/2026/06/01/california-executive-order-signals-more-scrutiny-of-ais-workplace-impact/",
    expected: ["Politics & Policy", "AI & ML"],
  },
  {
    id: "stored-8c763ecc",
    source: "stored",
    feedTitle: "Deeplinks",
    feedDescription: "EFF's Deeplinks Blog: Noteworthy news from around the internet",
    feedUrl: "https://www.eff.org/rss/updates.xml",
    feedSiteUrl: "https://www.eff.org/rss/updates.xml",
    sourceKind: "rss",
    itemTitle: "The Youth AI Privacy Act’s Privacy Paradox",
    itemSummary:
      "Update: The Senate Commerce Committee voted to advance this bill on August 5, 2026. EFF continues to oppose the bill, which still needs approval from the full Senate. The Senate Commerce Committee is poised to consider the Youth AI Privacy",
    itemContentText:
      "Update: The Senate Commerce Committee voted to advance this bill on August 5, 2026. EFF continues to oppose the bill, which still needs approval from the full Senate. The Senate Commerce Committee is poised to consider the Youth AI Privacy Act , a bill that would require AI companies to create kids-only privacy rules and implement so-called “safe design features,” which would — like three other bills under consideration this week—require more data collection and make it",
    itemUrl: "https://www.eff.org/deeplinks/2026/08/youth-ai-privacy-acts-privacy-paradox",
    expected: ["Security & Privacy", "Politics & Policy"],
    needsReview: true,
    note: "AI privacy bill; privacy vs policy vs AI",
  },
  {
    id: "stored-8fb07fc4",
    source: "stored",
    feedTitle: "Fiction Addiction Fix",
    feedDescription:
      "Readers of Christian Fiction: Find free books, Bloggers: Advertise giveaways, Authors of Christian Fiction: Gain new readers",
    feedUrl: "http://fictionaddictionfix.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://fictionaddictionfix.blogspot.com/",
    sourceKind: "rss",
    itemTitle:
      "Winner's Choice of any Christian Historical Fiction published in Oct, Nov or Dec 2022 ends Oct 1 #bookgiveaway",
    itemSummary: null,
    itemContentText: null,
    itemUrl: "http://fictionaddictionfix.blogspot.com/2022/09/winners-choice-of-any-christian.html",
    expected: ["Culture & Media"],
    needsReview: true,
    note: "Book giveaway, empty text",
  },
  {
    id: "stored-904f27c5",
    source: "stored",
    feedTitle: "PC News Category - Siliconera",
    feedDescription: "The secret level in the world of video game news.",
    feedUrl: "https://www.siliconera.com/category/pc/feed",
    feedSiteUrl: "https://www.siliconera.com/category/pc/",
    sourceKind: "rss",
    itemTitle: "Vanillaware’s Muramasa: Revenant Blades Release Date Set",
    itemSummary:
      "There's a release date trailer for the Vanillaware action-RPG Muramasa: Revenant Blades that confirms voice actors.",
    itemContentText:
      "We now know the release date for the Vanillaware game Muramasa: Revenant Blades, the updated multiplatform release of Muramasa: The Demon Blade . It turns out 2027 meant February 4, 2027. It will be on the Switch, Switch 2, PS5, and PC. There will also be physical versions and a limited edition for all consoles, and XSEED and Marvelous confirmed the Switch 2 version will not be a game-key card release. This announcement coincided with a new gameplay trailer . The latest",
    itemUrl: "https://www.siliconera.com/vanillawares-muramasa-revenant-blades-release-date-set/",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-907c6a89",
    source: "stored",
    feedTitle: "Wireless LAN Professionals",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://feeds.feedburner.com/ResourcesWirelessLanProfessionals",
    feedSiteUrl: "https://wlanprofessionals.com/",
    sourceKind: "rss",
    itemTitle: "One Access Point Per Classroom in K-12 Wi-Fi Design",
    itemSummary:
      "Putting one Access Point in every classroom does not make a school’s Wi-Fi better. It makes it worse. More APs packed close together is not more capacity, it is more co-channel contention, and contention is the thing that slows a network",
    itemContentText:
      "Putting one Access Point in every classroom does not make a school’s Wi-Fi better. It makes it worse. More APs packed close together is not more capacity, it is more co-channel contention, and contention is the thing that slows a network to a crawl the day the students actually show up with their devices. I wrote that in 2014. After running the full design process through more than 4,000 classrooms since, I have not found a single reason to change the verdict. Capacity is a",
    itemUrl: "https://wlanprofessionals.com/why-one-access-point-per-classroom-approach-is-wrong/",
    expected: ["Technology"],
  },
  {
    id: "stored-915d3d75",
    source: "stored",
    feedTitle: "Multifamily Mix with Barbara Savona",
    feedDescription:
      'Step into "The Multifamily Mix with Barbara Savona," your essential podcast for navigating the exciting world of multifamily housing. Join Barbara, a seasoned expert and CEO of Sprout Marketing, as',
    feedUrl: "https://feeds.redcircle.com/bf04d471-c3c3-4837-92ab-2e831859ad98",
    feedSiteUrl: "https://redcircle.com/shows/marketing-home-marketing-you1576",
    sourceKind: "rss",
    itemTitle: "12 March Resident Events for Unforgettable Community Fun",
    itemSummary:
      ">> Grab your free calendar planning packwww.TrySproutFree.com In this episode of 'The Multifamily Mix', Marci and Barbara of Sprout Marketing discuss creative ideas for 12 resident events to be held in March, featuring a range of themes",
    itemContentText:
      ">> Grab your free calendar planning packwww.TrySproutFree.com In this episode of 'The Multifamily Mix', Marci and Barbara of Sprout Marketing discuss creative ideas for 12 resident events to be held in March, featuring a range of themes and activities. The episode also includes suggestions on how to involve local businesses in the events to foster community connections. Additionally, they mention several opportunities for virtual events to cater to different resident",
    itemUrl: "https://watchyourbusinesssprout.com/sprout-marketing-blog/mix-podcast/9",
    expected: ["Business & Startups"],
    needsReview: true,
    note: "Property management resident events marketing podcast",
  },
  {
    id: "stored-918b865a",
    source: "stored",
    feedTitle: "SproutVideo",
    feedDescription: "Video hosting for business",
    feedUrl: "https://sproutvideo.com/blog/feed",
    feedSiteUrl: "https://sproutvideo.com/blog",
    sourceKind: "rss",
    itemTitle: "What Is Gated Video Content? 3 Types and When to Use Each",
    itemSummary:
      "6 MIN TO READ Gated video content restricts access using lead capture, paywalls, or business access controls. Each type of gated video content serves a different purpose. Same phrase; three completely different jobs. Learn when to use each",
    itemContentText:
      "Gated video content is media that requires viewers to complete a specific action, submitting contact information, making a payment, or verifying their identity, to gain access. The three most common video gates are video lead capture, video paywall, and business access control. Each video gate serves a different goal and requires different tools. A marketing team using video lead capture to gate a webinar needs a different solution than a course creator running a video",
    itemUrl: "https://sproutvideo.com/blog/gated-video-content.html",
    expected: ["Business & Startups"],
    needsReview: true,
    note: "Video gating marketing guide; business vs technology",
  },
  {
    id: "stored-91b31c8f",
    source: "stored",
    feedTitle: "Velo",
    feedDescription: "Competitive Cycling News, Race Results and Bike Reviews",
    feedUrl: "https://velo.outsideonline.com/feed?scope=anon",
    feedSiteUrl: "https://velo.outsideonline.com/",
    sourceKind: "rss",
    itemTitle: "Brain Surgery Five Months After Vehicle Collision: Guardeño Remains in Treatment",
    itemSummary:
      "23-year-old Jaume Guardeño in neurorehabilitation after suffering head injuries after reportedly losing control of bike in training incident. Read the full article at Brain Surgery Five Months After Vehicle Collision: Guardeño Remains in",
    itemContentText:
      "23-year-old Jaume Guardeño in neurorehabilitation after suffering head injuries after reportedly losing control of bike in training incident. Read the full article at Brain Surgery Five Months After Vehicle Collision: Guardeño Remains in Treatment on Velo .",
    itemUrl:
      "https://velo.outsideonline.com/road/road-racing/guardeno-brain-surgery-vehicle-collision/",
    expected: ["Sports"],
  },
  {
    id: "stored-91f4cb7f",
    source: "stored",
    feedTitle: "News - FinTech North",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.fintechnorth.uk/news/feed",
    feedSiteUrl: "https://new.fintechnorth.uk/news/",
    sourceKind: "rss",
    itemTitle:
      "27 Graduates Inducted into the FinTech Graduate Development Programme by Beckett Careers in Collaboration with FinTech North",
    itemSummary:
      "Last week, our Talent Upskilling Associate Silas OZOYA represented FinTech North as we formally inducted 27 Leeds Beckett University graduates into the Spring 2026 cohort of the Beckett Careers FinTech Graduate Development Programme",
    itemContentText:
      "Last week, our Talent Upskilling Associate Silas OZOYA represented FinTech North as we formally inducted 27 Leeds Beckett University graduates into the Spring 2026 cohort of the Beckett Careers FinTech Graduate Development Programme delivered in collaboration with FinTech North. Building on our existing work in enhancing the supply of FinTech skills into the North, the […] The post 27 Graduates Inducted into the FinTech Graduate Development Programme by Beckett Careers in",
    itemUrl:
      "https://www.fintechnorth.uk/27-graduates-inducted-into-the-fintech-graduate-development-programme-by-beckett-careers-in-collaboration-with-fintech-north/",
    expected: ["Education & Work"],
  },
  {
    id: "stored-9262a7a3",
    source: "stored",
    feedTitle: "walawlibrary - Medium",
    feedDescription:
      "The Washington State Law Library’s mission is to promote reliable access to legal information and provide expert legal reference assistance. Visit us online at: www.courts.wa.gov/library/. - Medium",
    feedUrl: "https://medium.com/feed/walawlibrary",
    feedSiteUrl: "https://medium.com/walawlibrary?source=rss----82223c540fe6---4",
    sourceKind: "rss",
    itemTitle: "The 2026 Legislative Session in Review",
    itemSummary:
      "This year the legislature packed a lot of big legislation into a short session. One of the biggest and most controversial was the new “millionaires tax” to be levied on household income above $1 million dollars. The millionaires tax bill",
    itemContentText:
      "This year the legislature packed a lot of big legislation into a short session. One of the biggest and most controversial was the new “millionaires tax” to be levied on household income above $1 million dollars. The millionaires tax bill proved to be quite a showdown as predicted. It passed with no Republican votes after more than 24 hours of debate. Democrats argue that the tax is needed to correct the state’s reliance on regressive taxes like the sales tax and that only 1%",
    itemUrl:
      "https://medium.com/walawlibrary/the-2026-legislative-session-in-review-31131a755461?source=rss----82223c540fe6---4",
    expected: ["Politics & Policy"],
  },
  {
    id: "stored-92f9a213",
    source: "stored",
    feedTitle: "Cosmetic Laser Centers",
    feedDescription: "Laser Treatments & Services | Cosmetic Laser Centers",
    feedUrl: "http://www.cosmeticlasercenters.com/feed",
    feedSiteUrl: "https://www.cosmeticlasercenters.com/",
    sourceKind: "rss",
    itemTitle: "Everything You Need to Know About Sculptra® Dermal Fillers",
    itemSummary:
      "Rejuvenate Your Skin and Achieve Natural-Looking Results with Botox® and Fillers Near You in Pittsburgh Whether you’ve been considering dermal fillers for a while or are just now learning about all they have to offer, there’s no doubt you",
    itemContentText:
      "Rejuvenate Your Skin and Achieve Natural-Looking Results with Botox® and Fillers Near You in Pittsburgh Whether you’ve been considering dermal fillers for a while or are just now learning about all they have to offer, there’s no doubt you have plenty of options when it comes to what injectable you use to treat your skin. […] The post Everything You Need to Know About Sculptra® Dermal Fillers first appeared on Cosmetic Laser Centers .",
    itemUrl:
      "https://www.cosmeticlasercenters.com/2023/01/04/everything-you-need-to-know-about-sculptra-dermal-fillers/",
    expected: [],
    needsReview: true,
    note: "Cosmetic filler clinic promo; none vs Health",
  },
  {
    id: "stored-94e856a8",
    source: "stored",
    feedTitle: "Democracy Paradox",
    feedDescription: "Home of the Democracy Paradox Podcast",
    feedUrl: "https://democracyparadox.com/feed",
    feedSiteUrl: "https://democracyparadox.com/",
    sourceKind: "rss",
    itemTitle: "Rachel Beatty Riedl Says Economic Inequality Is Fueling Democratic Backsliding",
    itemSummary:
      "Rachel Beatty Riedl is a Professor in the Brooks School of Public Policy and in the Department of Government at Cornell University and the Peggy J. Koenig ’78 Director of the Cornell Center on Democracy. She is the coeditor of Global",
    itemContentText:
      "Rachel Beatty Riedl is a Professor in the Brooks School of Public Policy and in the Department of Government at Cornell University and the Peggy J. Koenig ’78 Director of the Cornell Center on Democracy. She is the coeditor of Global Challenges to Democracy: Comparative Perspectives on Backsliding, Autocracy, and Resilience with Valerie Bunce, Tom Pepinsky, and Ken Roberts and the author of many articles including “Neoliberalism and the Third Wave” in the Journal of",
    itemUrl:
      "https://democracyparadox.com/2026/08/05/rachel-beatty-riedl-says-economic-inequality-is-fueling-democratic-backsliding/",
    expected: ["Politics & Policy"],
  },
  {
    id: "stored-95748bdc",
    source: "stored",
    feedTitle: "Toronto Sun - RSS Feed",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://torontosun.com/tag/anaheim-ducks/feed.xml",
    feedSiteUrl: "https://torontosun.com/",
    sourceKind: "rss",
    itemTitle: "LEAFS NOTES: Attention to defensive detail resulting in wins in recent games",
    itemSummary:
      "Auston Matthews’ march toward breaking the Maple Leafs’ record for most goals in a season — his record, mind you — has taken some of the spotlight off a crucial factor. The Leafs have returned to playing with solidified structure in recent",
    itemContentText:
      "Auston Matthews’ march toward breaking the Maple Leafs’ record for most goals in a season — his record, mind you — has taken some of the spotlight off a crucial factor. The Leafs have returned to playing with solidified structure in recent games, bringing to mind their stronger defensive play that was a theme in 2022-23. “That’s another game without giving up a five-on-five goal,” Leafs coach Sheldon Keefe said following Toronto’s 2-1 overtime win in Anaheim against the",
    itemUrl:
      "https://torontosun.com/sports/hockey/nhl/toronto-maple-leafs/attention-to-detail-in-recent-games-resulting-in-wins",
    expected: ["Sports"],
  },
  {
    id: "stored-95b5ab6e",
    source: "stored",
    feedTitle: "Black Girl Sunscreen",
    feedDescription: "Sunscreen for Black Women & Women of Color",
    feedUrl: "https://blackgirlsunscreen.com/feed",
    feedSiteUrl: "https://blackgirlsunscreen.com/",
    sourceKind: "rss",
    itemTitle: "Sunscreen For Men: Breaking Myths And Embracing Sun Safety",
    itemSummary:
      "Sunscreen provides essential protection for our skin against harmful UV rays. However, when it comes to men’s skin, there are The post Sunscreen For Men: Breaking Myths And Embracing Sun Safety appeared first on Black Girl Sunscreen .",
    itemContentText:
      "Sunscreen provides essential protection for our skin against harmful UV rays. However, when it comes to men’s skin, there are The post Sunscreen For Men: Breaking Myths And Embracing Sun Safety appeared first on Black Girl Sunscreen .",
    itemUrl: "https://blackgirlsunscreen.com/essential-sunscreen-for-men/",
    expected: ["Health & Medicine"],
    needsReview: true,
    note: "Sunscreen brand post; health vs beauty (none)",
  },
  {
    id: "stored-9766bc68",
    source: "stored",
    feedTitle: "Aviationkart - News",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.aviationkart.com/blogs/news.atom",
    feedSiteUrl: "https://www.aviationkart.com/blogs/news",
    sourceKind: "rss",
    itemTitle: "Best Business Class Cabins in the World (2026 Guide)",
    itemSummary:
      "Business Class has evolved into a premium travel experience that combines privacy, comfort, fine dining, and personalized service. Modern airlines now offer fully flat beds, direct aisle access, luxury lounges, gourmet meals, premium",
    itemContentText:
      "Business Class has evolved into a premium travel experience that combines privacy, comfort, fine dining, and personalized service. Modern airlines now offer fully flat beds, direct aisle access, luxury lounges, gourmet meals, premium entertainment, and exclusive airport services. What Makes a Great Business Class? Lie-flat seating Direct aisle access Privacy doors or suites High-quality dining Premium lounges Excellent cabin crew service Fast Wi-Fi and entertainment Top",
    itemUrl:
      "https://www.aviationkart.com/blogs/news/best-business-class-cabins-in-the-world-2026-guide",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-98b12a12",
    source: "stored",
    feedTitle: "North Lakes Homeopathy",
    feedDescription: "Homeopathy, Reiki, Craniosacral therapy, Breathwork and Nutrition",
    feedUrl: "https://www.northlakeshomeopathy.com.au/blog-feed.xml",
    feedSiteUrl: "https://www.northlakeshomeopathy.com.au/blog-1",
    sourceKind: "rss",
    itemTitle: "Low Libido in Women",
    itemSummary:
      "First of all there not just one reason but there is one common reason for low or no libido which we will explore first.",
    itemContentText:
      "First of all there not just one reason but there is one common reason for low or no libido which we will explore first.",
    itemUrl: "https://www.northlakeshomeopathy.com.au/post/low-libido-in-women",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-98f85689",
    source: "stored",
    feedTitle: "Easypromos Blog: digital engagement strategies and examples for brands",
    feedDescription:
      "Easypromos Blog: how to create interactive promotions and digital engagement experiences",
    feedUrl: "https://www.easypromosapp.com/blog/en/feed",
    feedSiteUrl: "https://www.easypromosapp.com/blog/en/",
    sourceKind: "rss",
    itemTitle: "How to Get more Likes on Facebook for your Business Page",
    itemSummary:
      "You've just created your Facebook Business Page, and there's one question on your mind: “Now what?” What should I do? What should I say? How do I start to build my audience? So we've put together this guide to getting your first 1,000",
    itemContentText:
      "1. Create a quality image for your Facebook page Before you start to publicize your page and build a community, make sure that you have good cover and profile pictures . Try to use original pictures that showcase your brand , in high resolution, with the correct image dimensions recommended by Facebook. As soon as someone clicks on your page, they should be able to see what you’re selling. Blurry images with low quality don’t generate trust, therefore, the clearer your",
    itemUrl: "https://www.easypromosapp.com/blog/en/how-to-get-1000-facebook-likes-in-6-steps/",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-9901fdcd",
    source: "stored",
    feedTitle: "BITCOIN GOLD (BTG)",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://bitcoingoldprice.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://bitcoingoldprice.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "VeChain price to rebound before resuming consolidation",
    itemSummary:
      "VeChain VET price looks ready for a leg up as the bulls have been awakened. VeChain VET appears to be primed for a short-term trend reversal before it faces further challenges that could hinder the asset’s long-term outlook. VeChain price",
    itemContentText:
      "VeChain VET price looks ready for a leg up as the bulls have been awakened. VeChain VET appears to be primed for a short-term trend reversal before it faces further challenges that could hinder the asset’s long-term outlook. VeChain price is aiming for a rebound after setting a new monthly low at $0.0633. VeChain VET has continuously recorded lower lows and lower highs since June 29, unable to galvanize investors’ enthusiasm. VeChain price is not showing clear cues as to",
    itemUrl: "https://bitcoingoldprice.blogspot.com/2021/07/vechain-price-to-rebound-before.html",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-99d26422",
    source: "stored",
    feedTitle: "Blog - Women Who Rock",
    feedDescription: "Women In Music Unite To Rock The Future of Women's Health",
    feedUrl: "https://womenwhorock.info/blog?format=rss",
    feedSiteUrl: "https://womenwhorock.info/blog/",
    sourceKind: "rss",
    itemTitle: "The Women Who Rock Women's History Month Playlist",
    itemSummary:
      "To kick off Women’s History Month, Women Who Rock has created a Spotify playlist featuring some incredible female musicians who have taken strides and made history by ignoring the rules and empowering women all over the world. Click below",
    itemContentText:
      "BY LAURA HARPER/WWR Staff Writer To kick off Women’s History Month, Women Who Rock has created a Spotify playlist featuring some incredible female musicians who have taken strides and made history by ignoring the rules and empowering women all over the world. You can check out the whole playlist here and keep reading to see some of our favorites below. “Man! I Feel Like a Woman!” – Shania Twain This song is all about letting go of all societal standards that define a",
    itemUrl:
      "https://womenwhorock.info/blog/2021/3/11/the-women-who-rock-womens-history-month-playlist",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-99f85d61",
    source: "stored",
    feedTitle: "Emory Libraries Blog",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://scholarblogs.emory.edu/woodruff/feed",
    feedSiteUrl: "https://scholarblogs.emory.edu/woodruff",
    sourceKind: "rss",
    itemTitle: "Sustainability in Bloom",
    itemSummary:
      "Sustainability projects at the Emory Libraries, Emory Center for Digital Scholarship, & Michael C. Carlos Museum are in full bloom this summer. A native Georgia plant species pollinator garden in front of the Robert W. Woodruff Library,",
    itemContentText:
      "Sustainability projects at the Emory Libraries, Emory Center for Digital Scholarship, & Michael C. Carlos Museum are in full bloom this summer. A native Georgia plant species pollinator garden in front of the Robert W. Woodruff Library, established by the Emory Libraries & Museum Environmental Sustainability Committee (ELMESC) in 2024 with support from Emory’s Office of Sustainability Initiatives, is in peak season—perfect for a break or lunch outside. Watch for our",
    itemUrl:
      "https://scholarblogs.emory.edu/woodruff/news/sustainability-in-bloom?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=sustainability-in-bloom",
    expected: ["Climate & Environment"],
  },
  {
    id: "stored-9a7673b7",
    source: "stored",
    feedTitle: "Wigwam",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.wigwamstorage.co.uk/feed",
    feedSiteUrl: "https://www.wigwamstorage.co.uk/",
    sourceKind: "rss",
    itemTitle: "Self Storage For Charities And Community Groups A Practical Guide",
    itemSummary:
      "Is the community hall cupboard finally impossible to close? There is a cupboard in almost every community hall in Britain. It holds three folding tables, a bundle of bunting from 2019, two gazebo bags, a box of raffle prizes that never got",
    itemContentText:
      "Is the community hall cupboard finally impossible to close? There is a cupboard in almost every community hall in Britain. It holds three folding tables, a bundle of bunting from 2019, two gazebo bags, a box of raffle prizes that never got used, and a stack of plastic chairs that belong to somebody else. Nobody is quite sure whose job it is to sort it. And slowly, season by season, it gets a little more impossible to close. If your group has reached that point, you are not",
    itemUrl:
      "https://www.wigwamstorage.co.uk/self-storage-for-charities-and-community-groups-a-practical-guide/",
    expected: [],
    needsReview: true,
    note: "Storage company content marketing; none vs World & Society",
  },
  {
    id: "stored-9b1f23d6",
    source: "stored",
    feedTitle: "Law & Business",
    feedDescription: "The podcast about legal issues and how they affect your business",
    feedUrl: "https://vernalaw.com/feed/podcast",
    feedSiteUrl: "https://vernalaw.com/",
    sourceKind: "rss",
    itemTitle: "Law & Business Podcast Episode 41: Talking Cannabis with Shad Ewart",
    itemSummary:
      "Shad B. Ewart has been a professor and administrator at Anne Arundel Community College since 2001. Prior to that, he was a professor of business at Mount Vernon College in Washington, DC. At Anne Arundel Community College, he has served as",
    itemContentText:
      "Shad B. Ewart has been a professor and administrator at Anne Arundel Community College since 2001. Prior to that, he was a professor of business at Mount Vernon College in Washington, DC. At Anne Arundel Community College, he has served as Department Chair and Director of Business Programs. As chair he designed the curriculum for the Business Support Specialist program and the Transportation Logistics and Cargo Security program. Many of his curricular innovations have been",
    itemUrl:
      "https://vernalaw.com/law-business-podcast-episode-41-talking-cannabis-with-shad-ewart/",
    expected: ["Business & Startups", "Education & Work"],
    needsReview: true,
    note: "Cannabis industry and college programs; business vs education",
  },
  {
    id: "stored-9c36aab8",
    source: "stored",
    feedTitle: "NASA - Ars Technica",
    feedDescription: "Serving the Technologist since 1998. News, reviews, and analysis.",
    feedUrl: "https://arstechnica.com/tag/nasa/feed",
    feedSiteUrl: "https://arstechnica.com/",
    sourceKind: "rss",
    itemTitle: 'Here\'s what we know about the "space academy" Trump just announced',
    itemSummary: "\"It's called the US Space Academy. That's a big deal.\"",
    itemContentText:
      'During a visit to Johnson Space Center, President Trump on Friday signed an executive order to establish a new commission with the purpose of creating the first national space academy. "It\'s clear that we will need to educate and train an entire generation of skilled service members, engineers, and civil operators, and everything else to do what we have to do," Trump said. "I will sign an executive order to begin the process of creating a new national academy. It\'s called',
    itemUrl:
      "https://arstechnica.com/space/2026/08/trump-calls-for-creation-of-a-space-academy-to-train-future-nasa-leaders/",
    expected: ["Politics & Policy", "Science & Research"],
    needsReview: true,
    note: "Space academy executive order; Politics vs Science",
  },
  {
    id: "stored-9cb87810",
    source: "stored",
    feedTitle: "Thenaijafame Blog",
    feedDescription:
      "Thenaijafame is a top Nigerian news blog, that focuses on Nigerian celebrity gossip, biographies, politics, news, romance..",
    feedUrl: "https://www.blogger.com/feeds/1402765131154201014/posts/default",
    feedSiteUrl: "https://www.blogger.com/feeds/1402765131154201014/posts/default",
    sourceKind: "rss",
    itemTitle: "Actor Walter Anga, And Wife, Celebrate 13th Wedding Anniversary",
    itemSummary:
      "Actor Walter Anga, And Wife, Celebrate 13th Wedding Anniversary Popular Nollywood actor, Walter Anga and his wife, Esther, are marking their 13th wedding anniversary on Monday. Taking to Instagram, the actor shared some throwback pictures",
    itemContentText:
      "Actor Walter Anga, And Wife, Celebrate 13th Wedding Anniversary Popular Nollywood actor, Walter Anga and his wife, Esther, are marking their 13th wedding anniversary on Monday. Taking to Instagram, the actor shared some throwback pictures and said, “Here’s for another year (of) being great together. Happy wedding anniversary to us my lovely wife #tyresetroy “It’s been 13 solid years together without pressure because you are a peaceful being 💓💓💓💓 13 years of success and",
    itemUrl: "https://www.blogger.com/feeds/1402765131154201014/posts/default/3420419243619160946",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-9d538995",
    source: "stored",
    feedTitle: "Apkfoji",
    feedDescription:
      "Apkfoji is a platform where you can find Android apps, games, and useful APKs. Download the latest apps and games with detailed information and updates.",
    feedUrl: "https://gamingstudio4u.blogspot.com/feeds/posts/default",
    feedSiteUrl: "https://www.blogger.com/feeds/401322862646000939/posts/default",
    sourceKind: "rss",
    itemTitle: "Best Legal Websites to Download Free PC Games (2026) – 100% Safe",
    itemSummary:
      "Best Websites to Download Free PC Games – 2026 Guide Playing games on PC can be a great way to fun and spend time with friends. However, get free games for PC online is not an easy way. Many games websites claim to offer free games, but",
    itemContentText:
      "Best Websites to Download Free PC Games – 2026 Guide Playing games on PC can be a great way to fun and spend time with friends. However, get free games for PC online is not an easy way. Many games websites claim to offer free games, but many provide malware files, unwanted files, and fake download buttons. This is why it is so crucial to find trusted legal website when downloading games. The good news for you is that you don’t need to spend money to get PC games. There are",
    itemUrl: "https://www.blogger.com/feeds/401322862646000939/posts/default/1264646612175068952",
    expected: ["Culture & Media"],
    needsReview: true,
    note: "SEO free-games download list; Culture vs Technology",
  },
  {
    id: "stored-9e3c252e",
    source: "stored",
    feedTitle: "Blog - Sustainability Leads",
    feedDescription:
      "Exploring Organizational Approaches to Sustainability and Corporate Social Responsibility",
    feedUrl: "http://sustainabilityleads.com/blog?format=RSS",
    feedSiteUrl: "http://sustainabilityleads.com/blog/",
    sourceKind: "rss",
    itemTitle: "Starbucks and LEED",
    itemSummary:
      "Starting in 2011, Starbucks adopted a new policy requiring all new building construction conform to certain LEED standards. Thirty major cities in the United States have implemented similar policies mandating certain new building",
    itemContentText:
      "Starting in 2011, Starbucks adopted a new policy goal requiring all new building construction conform to certain LEED standards. According to their 2015 Global Responsibility Report : “In 2008, we had one LEED certified store, and today, we have more than 800, including the LEED Platinum Starbucks Reserve Roastery and Tasting Room in Seattle.” Thirty major cities in the United States have implemented similar policies mandating certain new building construction meet LEED",
    itemUrl: "http://sustainabilityleads.com/blog/2017/3/23/starbucks-and-leed",
    expected: ["Climate & Environment"],
  },
  {
    id: "stored-9ebd889a",
    source: "stored",
    feedTitle: "Posts on Catnap Games",
    feedDescription: "Recent content in Posts on Catnap Games",
    feedUrl: "https://www.catnapgames.com/posts/index.xml",
    feedSiteUrl: "https://www.catnapgames.com/posts/",
    sourceKind: "rss",
    itemTitle: "13 interesting sound design videos",
    itemSummary:
      "Some really nice ones. Filed for future reference. Killzone Shadow Fall - Sound Design Behind The Scenes - PS4 Star Marine: Audio Update The Sound Design of Battlefield 3 - Game Informer The Sounds of Monsters in Borderlands 2 Skyrim's",
    itemContentText:
      "Some really nice ones. Filed for future reference. Killzone Shadow Fall - Sound Design Behind The Scenes - PS4 Star Marine: Audio Update The Sound Design of Battlefield 3 - Game Informer The Sounds of Monsters in Borderlands 2 Skyrim's Sound Design The Sound Design of Mass Effect 3 Sound Design of Halo 4 Making Batman: Arkham City - Sound Effects The Terrifying Sound Design of Dead Space 3: Kill Screen Episode 5 Arma III - Marksmen DLC Developer Diary: Weapons & Platform",
    itemUrl: "https://www.catnapgames.com/2015/09/13/13-interesting-sound-design-videos/",
    expected: ["Culture & Media"],
    needsReview: true,
    note: "Game sound design links; Culture vs Design",
  },
  {
    id: "stored-9f928db4",
    source: "stored",
    feedTitle: "Multifamily Mix with Barbara Savona",
    feedDescription:
      'Step into "The Multifamily Mix with Barbara Savona," your essential podcast for navigating the exciting world of multifamily housing. Join Barbara, a seasoned expert and CEO of Sprout Marketing, as',
    feedUrl: "https://feeds.redcircle.com/bf04d471-c3c3-4837-92ab-2e831859ad98",
    feedSiteUrl: "https://redcircle.com/shows/marketing-home-marketing-you1576",
    sourceKind: "rss",
    itemTitle: "#64 - Mom, Manager, and Major Team Motivator - Alexandra Adkins",
    itemSummary:
      "How do you create a company culture that wants to work and make big goals happen? How do you have a team succeed during difficult times? Learn from a manager what it takes to lead a team. What you will learn in this podcast: - Advice for",
    itemContentText:
      "How do you create a company culture that wants to work and make big goals happen? How do you have a team succeed during difficult times? Learn from a manager what it takes to lead a team. What you will learn in this podcast: - Advice for Leasing Agents, Property Managers, and Regionals - What To Look for in Team Building - How To Stand Out Personally Get your spark back at work and in life with Sprout's $7 SPARK membership: sparkwithsprout.com Advertising Inquiries:",
    itemUrl: "https://www.watchyourbusinesssprout.com/sprout-marketing-blog/team-motivator",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-9fa51609",
    source: "stored",
    feedTitle: "90min EN Feed",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.90min.com/posts.rss",
    feedSiteUrl: "https://www.90min.com/",
    sourceKind: "rss",
    itemTitle: "CHARLY launches 2025 Heritage Collection celebrating Mexico’s football and culture",
    itemSummary:
      "CHARLY’s 2025 Heritage Collection celebrates Mexico’s football and cultural heritage with four symbolic jerseys, Quetzalcoatl motifs, and bold “MEXICO” branding.",
    itemContentText:
      "CHARLY’s 2025 Heritage Collection celebrates Mexico’s football and cultural heritage with four symbolic jerseys, Quetzalcoatl motifs, and bold “MEXICO” branding.",
    itemUrl:
      "https://www.90min.com/charly-launches-2025-heritage-collection-celebrating-mexico-football-culture?utm_source=RSS",
    expected: ["Sports"],
    needsReview: true,
    note: "Jersey collection launch; product/fashion vs Sports",
  },
  {
    id: "stored-a0ac48f0",
    source: "stored",
    feedTitle: "KISS THE BOOK",
    feedDescription: "Reviews for school librarians",
    feedUrl: "https://kissthebook.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://kissthebook.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Cry Out Loud by Tara O'Connor - ADVISABLE",
    itemSummary:
      "Cry Out Loud by Tara O'Connor , 256 pages. GRAPHIC NOVEL Random House, 2025. $25. Language: PG (4 swears 0 'f' - Irish swears not counted); Mature Content: PG (same gender kisses); Violence: PG (human sacrifice is a plotline) BUYING",
    itemContentText:
      "Cry Out Loud by Tara O'Connor, 256 pages. GRAPHIC NOVEL Random House, 2025. $25. Language: PG (4 swears 0 'f' - Irish swears not counted); Mature Content: PG (same gender kisses); Violence: PG (human sacrifice is a plotline) BUYING ADVISORY: MS - ADVISABLE APPEALS TO: SOME Nell is suspended for a term from high school, and her mother sends her to stay with a distant relative in rural Ireland. Everything is strange from the beginning, but then becomes dangerous when Nell",
    itemUrl: "https://kissthebook.blogspot.com/2026/09/cry-out-loud-by-tara-oconnor-advisable.html",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-a0d41841",
    source: "stored",
    feedTitle: "The Ancestry Insider",
    feedDescription:
      "The unofficial, unauthorized view of Ancestry.com and FamilySearch.org. The Ancestry Insider reports on, defends, and constructively criticizes these two websites and associated topics. The author",
    feedUrl: "http://feeds.feedburner.com/AncestryInsider",
    feedSiteUrl: "http://www.blogger.com/feeds/5512311610334754148/posts/default?redirect=false",
    sourceKind: "rss",
    itemTitle: "Darned Undertaking",
    itemSummary:
      "We depend upon records to reveal the “truth” about the past. Yet sometimes records have anomalies. Some are amusing or humorous. Some are interesting or weird. Some are peculiar or suspicious. Some are infuriating, or downright laughable.",
    itemContentText:
      "We depend upon records to reveal the “truth” about the past. Yet sometimes records have anomalies. Some are amusing or humorous. Some are interesting or weird. Some are peculiar or suspicious. Some are infuriating, or downright laughable. Records say the darnedest things ! Kenneth H. Rich was the undertaker. He was also the decedent. Weird. After 30 years as an undertaker, Kenneth retired just 7 weeks before his doctor started treating him for interstitial nephritis . Less",
    itemUrl: "http://www.blogger.com/feeds/5512311610334754148/posts/default/792895766825671475",
    expected: [],
    needsReview: true,
    note: "Genealogy hobby post; no fitting label",
  },
  {
    id: "stored-a16738e1",
    source: "stored",
    feedTitle: "Kwixand Solutions",
    feedDescription:
      "As a trusted Microsoft Dynamics Partner, we work with clients across various industries to help achieve their business goals and scale with ease.",
    feedUrl: "https://www.kwixand.com/blog-feed.xml",
    feedSiteUrl: "https://www.kwixand.com/blog",
    sourceKind: "rss",
    itemTitle: "6 Non-Profit Cloud Technology Myths Debunked",
    itemSummary:
      "In this article, we clear up common misconceptions about what the cloud means for non-profit organizations.",
    itemContentText:
      "In this article, we clear up common misconceptions about what the cloud means for non-profit organizations. Many non-profit organizations are exploring cloud technology as a way to address one of their biggest challenges: doing more with less. Non-profits are often working with limited budgets, lean teams, fluctuating funding, and growing demands for services. At the same time, they are expected to provide transparency to donors, improve reporting, strengthen community",
    itemUrl: "https://www.kwixand.com/post/6-non-profit-cloud-technology-myths-debunked",
    expected: ["Technology"],
  },
  {
    id: "stored-a19e81bf",
    source: "stored",
    feedTitle: "Anki On The Move",
    feedDescription: "Exploring deeply, moving meaningfully.",
    feedUrl: "https://www.ankionthemove.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://www.ankionthemove.com/",
    sourceKind: "rss",
    itemTitle: "Aspen | Maroon Bells and Crater Lake",
    itemSummary:
      "Just as they say, sometimes it isn't our day. Yet sometimes, a mere peek-a-boo of sun from behind the mountains in a dried up Crater lake that we can walk on gives us a ray of hope. The hope that was met with an endearing silence as it",
    itemContentText:
      "Just as they say, sometimes it isn't our day. Yet sometimes, a mere peek-a-boo of sun from behind the mountains in a dried up Crater lake that we can walk on gives us a ray of hope. The hope that was met with an endearing silence as it thrashed when reflections on Maroon Bells did not form on moving waters just as they had said in numerous pictures on the internet. The twin peaks above 14,000 feet that are called bells still stood tall and mighty. Besides, Aspen had a strict",
    itemUrl: "https://www.ankionthemove.com/2021/01/aspen-maroon-bells-and-crater-lake.html",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-a23d07e0",
    source: "stored",
    feedTitle: "Teacher Tom",
    feedDescription: "Teaching and learning from preschoolers",
    feedUrl: "https://feeds.feedburner.com/TeacherTom",
    feedSiteUrl: "http://www.blogger.com/feeds/15932919/posts/default?redirect=false",
    sourceKind: "rss",
    itemTitle: 'I\'m a "Bad Teacher"',
    itemSummary:
      "Yesterday, I wrote about a dialog with a boy who gave me insight into myself as a teacher. That reminded me of similar story: A five-year-old boy once accused me of being a \"bad teacher.\" He wasn't mad at me. It wasn't intended as an",
    itemContentText:
      'Yesterday, I wrote about a dialog with a boy who gave me insight into myself as a teacher. That reminded me of similar story: A five-year-old boy once accused me of being a "bad teacher." He wasn\'t mad at me. It wasn\'t intended as an insult. He was grinning as he said it, but he offered it more as a statement of fact than a joke. I\'ve had children tell me that I\'m "supposed to be a boy," "you smell stinky," and "you\'re a big, fat guy." Learning the unvarnished, unblinking',
    itemUrl: "http://www.blogger.com/feeds/15932919/posts/default/5068579974119539640",
    expected: ["Education & Work", "Personal & Essays"],
  },
  {
    id: "stored-a24643ee",
    source: "stored",
    feedTitle: "News - The Alcuin Society",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.alcuinsociety.com/news?format=rss",
    feedSiteUrl: "https://www.alcuinsociety.com/news/",
    sourceKind: "rss",
    itemTitle: "42nd Alcuin Awards – Winners Announced",
    itemSummary:
      "FOR IMMEDIATE RELEASE April 8, 2025 The Alcuin Society announces the winners of the 42nd Alcuin Society’s Awards for Excellence in Book Design in Canada. The judging took place on Saturday, April 5th at Sheridan College’s Hazel McCallion",
    itemContentText:
      "FOR IMMEDIATE RELEASE April 8, 2025 The Alcuin Society announces the winners of the 42nd Alcuin Society’s Awards for Excellence in Book Design in Canada. The judging took place on Saturday, April 5th at Sheridan College’s Hazel McCallion campus in Mississauga, Ontario. The judges were three very experienced book designers, Donna Braggins, Bryan Gee and Shelley Gruendler. They had before them 228 submitted entries from 81 Canadian publishers. All books were designed by",
    itemUrl: "https://www.alcuinsociety.com/news/42nd-alcuin-awards-winners-announced",
    expected: ["Design & UX", "Culture & Media"],
  },
  {
    id: "stored-a25ae87e",
    source: "stored",
    feedTitle: "Seconds Out",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.secondsout.com/feed",
    feedSiteUrl: "https://www.secondsout.com/",
    sourceKind: "rss",
    itemTitle:
      "Johnny Nelson Delivers Honest Verdict On Fury vs Joshua Location Issues: “Stand Your Ground”",
    itemSummary:
      "Former world champion turned pundit Johnny Nelson has some advice for about the location of his fight with . These two heavyweights were expected to sign to fight each other shortly after they both had outings in July. Joshua had a",
    itemContentText:
      "Former world champion turned pundit Johnny Nelson has some advice for about the location of his fight with . These two heavyweights were expected to sign to fight each other shortly after they both had outings in July. Joshua had a terrible start against Kristian Prenga when he was put down twice in the first [&#8230;]",
    itemUrl: "https://www.secondsout.com/news/johnny-nelson-on-fury-vs-joshua-location/",
    expected: ["Sports"],
  },
  {
    id: "stored-a2a022b2",
    source: "stored",
    feedTitle: "Wicked Good Perfume - Clean Consciously Crafted Perfume | Wicked Good Blog",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://wicked-good.co/blogs/clean-perfume.atom",
    feedSiteUrl: "https://wicked-good.co/blogs/clean-perfume",
    sourceKind: "rss",
    itemTitle: "A New Year Ritual, Not a Resolution",
    itemSummary:
      "Because your year doesn’t need fixing. It needs intention. Every January, we’re told to reinvent ourselves. New goals. New habits. New rules. A better version. A shinier version. A more productive version. And honestly? That’s exhausting.",
    itemContentText:
      "Because your year doesn’t need fixing. It needs intention. Every January, we’re told to reinvent ourselves. New goals. New habits. New rules. A better version. A shinier version. A more productive version. And honestly? That’s exhausting. At Wicked Good, we don’t believe the new year is about becoming someone else. We believe it’s about returning to yourself . Not through pressure. Not through hustle. But through ritual. Because rituals stick where resolutions fail. Why",
    itemUrl: "https://wicked-good.co/blogs/clean-perfume/new-year-ritual-not-resolution",
    expected: [],
    needsReview: true,
    note: "Perfume brand essay on rituals; none vs Personal & Essays",
  },
  {
    id: "stored-a5626dbf",
    source: "stored",
    feedTitle: "Strobes Security Blog",
    feedDescription:
      "Insights on cybersecurity, vulnerability management, CTEM, and exposure management from the Strobes Security team.",
    feedUrl: "https://strobes.co/feed.xml",
    feedSiteUrl: "https://strobes.co/blog",
    sourceKind: "rss",
    itemTitle: "Top CVEs of May 2026: 5 Critical Flaws to Patch Now",
    itemSummary:
      "Five CVEs dominated May 2026: cPanel's two-month zero-day, Linux's stealth kernel priv-esc, Langflow exploited 20 hours after disclosure, n8n's perfect-10 RCE chain, and Microsoft's SSO bypass. Here's what happened and what to do.",
    itemContentText:
      "Five CVEs dominated May 2026: cPanel's two-month zero-day, Linux's stealth kernel priv-esc, Langflow exploited 20 hours after disclosure, n8n's perfect-10 RCE chain, and Microsoft's SSO bypass. Here's what happened and what to do.",
    itemUrl: "https://strobes.co/blog/top-cves-may-2026-5-critical-flaws-to-patch-now",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-a5c01add",
    source: "stored",
    feedTitle: "Asia's Developing Future",
    feedDescription:
      "ADBI is the think tank of the Asian Development Bank. We conduct policy research and capacity building to drive sustainable development in Asia and the Pacific.",
    feedUrl: "https://feeds.soundcloud.com/users/soundcloud:users:287130128/sounds.rss",
    feedSiteUrl: "http://www.adbi.org/",
    sourceKind: "rss",
    itemTitle:
      "Asia could lay the groundwork for a post-pandemic infrastructure boom through fairer land use",
    itemSummary:
      "Meeting developing Asia and the Pacific’s demand for quality infrastructure that can support inclusive post-pandemic growth will requires the steady but equitable acquisition of land. However, geography, settlement patterns, conflicting",
    itemContentText:
      "Meeting developing Asia and the Pacific’s demand for quality infrastructure that can support inclusive post-pandemic growth will requires the steady but equitable acquisition of land. However, geography, settlement patterns, conflicting cultures, and unique country-level land use problems often raise concerns about the fairness of land procurement and undermine project viability. In this podcast, Piyush Tiwari of the University of Melbourne examines land development",
    itemUrl:
      "https://soundcloud.com/adbinstitute/asia-groundwork-post-pandemic-infrastructure-fairer-land-use",
    expected: ["Politics & Policy"],
    needsReview: true,
    note: "Asian infrastructure land use policy podcast; Policy vs Society",
  },
  {
    id: "stored-a5d1ec27",
    source: "stored",
    feedTitle: "RadarOnline > TRUE CRIME NEWS",
    feedDescription:
      "Discover gripping true crime news, real-life crime stories, and reviews of the best true crime podcasts. Stay updated with Radar Online’s true crime coverage.",
    feedUrl: "https://radaronline.com/true-crime/rss",
    feedSiteUrl: "https://radaronline.com/true-crime/",
    sourceKind: "rss",
    itemTitle:
      "EXCLUSIVE: Savannah Guthrie Reacts After Security Breach at the 'Today' Show Studio",
    itemSummary:
      "The security breach came as Savannah continues to grapple with the disappearance of her mother.",
    itemContentText:
      "The security breach came as Savannah continues to grapple with the disappearance of her mother.",
    itemUrl:
      "https://radaronline.com/p/savannah-guthrie-today-studio-security-breach-nancy-missing/",
    expected: ["Culture & Media", "World & Society"],
    needsReview: true,
    note: "Celebrity news with crime angle; Culture vs World",
  },
  {
    id: "stored-a612bb39",
    source: "stored",
    feedTitle: "Category – European Union",
    feedDescription: "The latest updates to Category – European Union.",
    feedUrl:
      "https://www.hunton.com/privacy-and-cybersecurity-law-blog/category/european-union?rss",
    feedSiteUrl:
      "https://www.hunton.com/privacy-and-cybersecurity-law-blog/category/european-union",
    sourceKind: "rss",
    itemTitle:
      "U.S. Supreme Court FTC Ruling Prompts Fresh Scrutiny of EU-U.S. Data Privacy Framework",
    itemSummary:
      "As reported by Bloomberg Law , a European Commission spokesperson has stated that the European Commission will assess whether the recent U.S. Supreme Court ruling in Trump v. Slaughter , which addressed the U.S. president’s authority to",
    itemContentText:
      "As reported by Bloomberg Law , a European Commission spokesperson has stated that the European Commission will assess whether the recent U.S. Supreme Court ruling in Trump v. Slaughter , which addressed the U.S. president’s authority to remove Federal Trade Commission Commissioners, could affect the validity of the EU-U.S. Data Privacy Framework. Continue Reading ›",
    itemUrl:
      "https://www.hunton.com/privacy-and-cybersecurity-law-blog/u-s-supreme-court-ftc-ruling-prompts-fresh-scrutiny-of-eu-u-s-data-privacy-framework",
    expected: ["Politics & Policy", "Security & Privacy"],
  },
  {
    id: "stored-a7780d9e",
    source: "stored",
    feedTitle: "Blog - Patio Comfort",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://patiocomfort.ca/blog/feed",
    feedSiteUrl: "https://patiocomfort.ca/blog/",
    sourceKind: "rss",
    itemTitle: "5 Outdoor Furniture Trends to Elevate Your Patio in Ottawa",
    itemSummary:
      "Redefining Your Outdoor Space with Stylish Trends Your patio is more than just an extension of your home; it’s where some of the best memories are made. From quiet coffee mornings to lively family barbecues, the right outdoor furniture can",
    itemContentText:
      "Redefining Your Outdoor Space with Stylish Trends Your patio is more than just an extension of your home; it’s where some of the best memories are made. From quiet coffee mornings to lively family barbecues, the right outdoor furniture can transform this space into a haven. Keeping up with the latest trends helps you create a patio that’s not only functional but also a reflection of your style. Outdoor living in Ottawa comes with unique challenges. The furniture you choose",
    itemUrl: "https://patiocomfort.ca/5-outdoor-furniture-trends-to-elevate-your-patio-in-ottawa/",
    expected: [],
    needsReview: true,
    note: "Patio furniture trends marketing; possibly Design & UX",
  },
  {
    id: "stored-a7da2167",
    source: "stored",
    feedTitle: "San Diego County News Center",
    feedDescription: "Direct To You",
    feedUrl: "https://www.countynewscenter.com/news/rss",
    feedSiteUrl: "https://www.countynewscenter.com/",
    sourceKind: "rss",
    itemTitle: "County Public Health Leaders Stress Fall Vaccinations to Prevent Severe Illness",
    itemSummary:
      "Reading Time: < 1 minute The County rolled out a new influenza vaccination dashboard this week, just as flu shots hit clinics and pharmacies across the region. The interactive tool lets you track flu, COVID-19 and RSV vaccination rates—and",
    itemContentText:
      "Reading Time: < 1 minute The County rolled out a new influenza vaccination dashboard this week, just as flu shots hit clinics and pharmacies across the region. The interactive tool lets you track flu, COVID-19 and RSV vaccination rates—and it is updated weekly to help you stay informed. More",
    itemUrl:
      "https://www.countynewscenter.com/county-public-health-leaders-stress-fall-vaccinations-to-prevent-severe-illness/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=county-public-health-leaders-stress-fall-vaccinations-to-prevent-severe-illness",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-a7ffdd24",
    source: "stored",
    feedTitle: "Personal Training Master",
    feedDescription: "Fitness, Leanness, Performance",
    feedUrl: "https://www.personaltrainingmaster.co.uk/feed",
    feedSiteUrl: "https://www.personaltrainingmaster.co.uk/",
    sourceKind: "rss",
    itemTitle: "Best Sitting Positions for Sciatica | Office, Car, and Sofa Guide",
    itemSummary:
      "The post Best Sitting Positions for Sciatica | Office, Car, and Sofa Guide appeared first on Personal Training Master .",
    itemContentText:
      "Introduction If you are living in London or anywhere in the UK and dealing with sciatica pain, do you know that the way you sit each day is either helping in relieving your pain OR quietly making it worse? YES, sitting position for sciatica pain is something most people from London do not know about. In a busy lifestyle of London where most of the day is spent at desks, in cars, or on sofas, sitting is unavoidable. BUT, Sitting itself is not the problem, but it is the",
    itemUrl:
      "https://www.personaltrainingmaster.co.uk/best-sitting-positions-for-sciatica-office-car-and-sofa-guide/",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-a8da8936",
    source: "stored",
    feedTitle: "Food Turkey",
    feedDescription: "Turkish Food Magazine",
    feedUrl: "https://www.foodturkey.com.tr/en/feed",
    feedSiteUrl: "https://www.foodturkey.com.tr/en/",
    sourceKind: "rss",
    itemTitle: "ACTEGA to Showcase Next-Generation Metal Packaging Solutions at METPACK 2026",
    itemSummary:
      "Wesel, 2 April, 2026 – ACTEGA, manufacturer of specialty coatings, inks, adhesives, sealants and compounds for the print and packaging industry, has announced its participation in METPACK 2026 (5-8 May 2026, Messe Essen, Germany), where it",
    itemContentText:
      "Wesel, 2 April, 2026 – ACTEGA, manufacturer of specialty coatings, inks, adhesives, sealants and compounds for the print and packaging industry, has announced its participation in METPACK 2026 (5-8 May 2026, Messe Essen, Germany), where it will be exhibiting in Hall 3, stand 3C55. As a global, full-range solution provider for metal packaging, ACTEGA will demonstrate its extensive portfolio of high-performance solutions, all engineered to meet the industry’s rigorous demands",
    itemUrl:
      "https://www.foodturkey.com.tr/2026/04/03/actega-to-showcase-next-generation-metal-packaging-solutions-at-metpack-2026/",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-a94d7b31",
    source: "stored",
    feedTitle: "Fairytale Club Blog - Andrea Bethke",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://andreabethke.com/fairytale-club-blog?format=rss",
    feedSiteUrl: "https://andreabethke.com/fairytale-club-blog/",
    sourceKind: "rss",
    itemTitle: '"Truth, Beauty, Freedom, Love" | New Collection Sneak Peek!!!',
    itemSummary:
      'Hello everyone! I\'m so super excited right now to share with you a sneak peek of our new collection, "Truth, Beauty, Freedom, Love"! A lot went into the creation of this collection, and I have been both so nervous and so excited for you',
    itemContentText:
      "Hello everyone! I'm so super excited right now to share with you a sneak peek of our new collection, \"Truth, Beauty, Freedom, Love\"! A lot went into the creation of this collection, and I have been both so nervous and so excited for you all to see it! This is just a sneak peek for now, but the full reveal is coming soon! I can't wait for you all to see everything! For now, enjoy this sneak peek. As you can see, this collection has a very “early 20th century vintage” feel",
    itemUrl:
      "https://andreabethke.com/fairytale-club-blog/2021/3/28/truth-beauty-freedom-love-new-collection-sneak-peek",
    expected: [],
  },
  {
    id: "stored-a96ecb60",
    source: "stored",
    feedTitle: "Slow Travel Berlin",
    feedDescription: "Berlin - The Slow Way",
    feedUrl: "http://www.slowtravelberlin.com/feed",
    feedSiteUrl: "https://www.slowtravelberlin.com/",
    sourceKind: "rss",
    itemTitle: "The Berlin Election 2026",
    itemSummary: "Our overview of the upcoming Berlin Elections…",
    itemContentText:
      "Our overview of the main manifestos and mayoral candidates… You know it’s election time in Berlin when you step out of your house and the streetlights have been festooned with airbrushed portraits of grinning politicians offering utopian promises in the shape of pithy slogans. Germany’s Wahlplakate tradition seems somewhat old-fashioned in the digital era but the political parties obviously still consider it an important way of reaching voters since there are around a",
    itemUrl: "https://www.slowtravelberlin.com/berlin-election-overview/",
    expected: ["Politics & Policy"],
  },
  {
    id: "stored-abe36144",
    source: "stored",
    feedTitle: "Mashable",
    feedDescription: "Mashable is a global, multi-platform media and entertainment company.",
    feedUrl: "https://mashable.com/feeds/rss/social-media",
    feedSiteUrl: "https://mashable.com/",
    sourceKind: "rss",
    itemTitle: "Mexico vs. South Korea: The World Cups friendliest rivalry",
    itemSummary:
      "Ahead of Mexico vs. South Korea, fans from both countries are celebrating together, creating one of the World Cup's most delightful friendships.",
    itemContentText:
      'If the FIFA World Cup were a romantic comedy, Mexico and South Korea would be in the strangers-to-lovers arc. Before their teams even met on the pitch, fans from both countries had already hit it off. In the streets of Guadalajara, supporters have broken into impromptu performances of "Gangnam Style," greeted one another with chants of "BTS," posed for photos together, and shared not only bottles of tequila but also videos of their celebrations across social media. Which',
    itemUrl: "https://mashable.com/life/mexico-vs-south-korea-world-cup-match-friendliest-rivalry",
    expected: ["Sports"],
  },
  {
    id: "stored-ad4682d1",
    source: "stored",
    feedTitle: "Office Furniture Dubai | Modern Office Desks and Chairs",
    feedDescription: "Office Furniture Officemaster chair desk workstation flooring carpet",
    feedUrl: "https://officemaster.ae/feed",
    feedSiteUrl: "https://officemaster.ae/",
    sourceKind: "rss",
    itemTitle: "Why Standard Ergonomic Desk Heights Fail Most Office Workers",
    itemSummary:
      "The 73 cm Problem That Is Hurting Millions of Workers Walk into virtually any conventional office in Dubai, Abu Dhabi, or Sharjah, and you will find the same piece of furniture repeated from one end of the floor to the other: a desk",
    itemContentText:
      "The 73 cm Problem That Is Hurting Millions of Workers Walk into virtually any conventional office in Dubai, Abu Dhabi, or Sharjah, and you will find the same piece of furniture repeated from one end of the floor to the other: a desk standing precisely 73 to 75 centimeters from the ground. This dimension was not derived from biomechanical research or population-wide anthropometric studies. It emerged from the manufacturing constraints of mid-twentieth century furniture",
    itemUrl: "https://officemaster.ae/why-standard-desk-heights-fail-office-workers/",
    expected: ["Health & Medicine"],
    needsReview: true,
    note: "Office ergonomics marketing; health vs workplace vs design",
  },
  {
    id: "stored-adb3fbfd",
    source: "stored",
    feedTitle: "A Book Owl's Corner",
    feedDescription: "Bookish Ramblings of an Owl-Obsessed Math Nerd",
    feedUrl: "https://abookowlscorner.com/feed",
    feedSiteUrl: "https://abookowlscorner.com/",
    sourceKind: "rss",
    itemTitle: "What I Read in November and December 2025",
    itemSummary:
      "Happy New Year, everyone! It’s 2026, a number I have yet to discover a cool mathematical fact about. The prime factorization is 2*1013, which is kind of boring, the sum of all digits is 10, which is okay, I guess, and if you multiply all",
    itemContentText:
      "Happy New Year, everyone! It’s 2026, a number I have yet to discover a cool mathematical fact about. The prime factorization is 2*1013, which is kind of boring, the sum of all digits is 10, which is okay, I guess, and if you multiply all digits, you get 0 – not all that exciting… However, maybe the relative unexcitingness of 2026 is a good thing because honestly? I could do with a bit of relaxation and calm this year. Especially since my last two months were anything but.",
    itemUrl: "https://abookowlscorner.com/2026/01/06/what-i-read-in-november-and-december-2025/",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-ae2da01a",
    source: "stored",
    feedTitle: "UrbanMatter",
    feedDescription: "For What Really Matters",
    feedUrl: "https://urbanmatter.com/chicago/feed",
    feedSiteUrl: "https://urbanmatter.com/chicago/",
    sourceKind: "rss",
    itemTitle:
      "Cubs vs. Pirates Game September 11 2026: Why Pittsburgh’s Bullpen, Not Its Record, Is the Real Threat Today",
    itemSummary:
      "Pittsburgh Pirates (73-73) at Chicago Cubs (81-66) | Friday, September 11, 2026 | 1:20 PM CT | Wrigley Field, Chicago, IL I’ll admit something as a Cubs fan… The post Cubs vs. Pirates Game September 11 2026: Why Pittsburgh’s Bullpen, Not",
    itemContentText:
      "Pittsburgh Pirates (73-73) at Chicago Cubs (81-66) | Friday, September 11, 2026 | 1:20 PM CT | Wrigley Field, Chicago, IL I’ll admit something as a Cubs fan going into this one: I checked the Pirates’ record, saw .500, and almost didn’t bother digging any deeper. That would’ve been a mistake. Chicago is walking into this series on a four-game losing streak, and Pittsburgh is playing the best baseball of its season at exactly the wrong time for us — 8-2 over its last 10",
    itemUrl:
      "https://urbanmatter.com/chicago/cubs-vs-pirates-game-september-11-2026-why-pittsburghs-bullpen-not-its-record-is-the-real-threat-today/",
    expected: ["Sports"],
  },
  {
    id: "stored-ae8b0a6a",
    source: "stored",
    feedTitle: "MIAJA DESIGN GROUP - draft",
    feedDescription: "MIAJA Design Group",
    feedUrl: "https://www.miajadesigngroup.com/blog-feed.xml",
    feedSiteUrl: "https://www.miajadesigngroup.com/blog",
    sourceKind: "rss",
    itemTitle: "Quarterly Newsletter | September 2023",
    itemSummary:
      "We are thrilled to announce the successful completion of two remarkable projects, the Lotte Hotel Busan and Tomlinson Heights Residences,...",
    itemContentText:
      "We are thrilled to announce the successful completion of two remarkable projects, the Lotte Hotel Busan and Tomlinson Heights Residences,...",
    itemUrl: "https://www.miajadesigngroup.com/post/miaja-september-news",
    expected: ["Design & UX"],
    needsReview: true,
    note: "Thin design firm newsletter; design vs business",
  },
  {
    id: "stored-aec28f49",
    source: "stored",
    feedTitle: "Werever Outdoor Cabinets",
    feedDescription: "Built to Last a Lifetime",
    feedUrl: "https://werever.com/feed",
    feedSiteUrl: "https://werever.com/",
    sourceKind: "rss",
    itemTitle: "Outdoor Kitchen Dimensions: How Much Space Do You Need?",
    itemSummary:
      "A successful outdoor kitchen isn’t necessarily the biggest one; it’s the one that uses available space effectively. The right dimensions make cooking easier, prevent traffic bottlenecks, and give guests enough room to gather without",
    itemContentText:
      "A successful outdoor kitchen isn’t necessarily the biggest one; it’s the one that uses available space effectively. The right dimensions make cooking easier, prevent traffic bottlenecks, and give guests enough room to gather without crowding the person at the grill. Because every patio, deck, and backyard is different, your layout should be designed around your […] The post Outdoor Kitchen Dimensions: How Much Space Do You Need? appeared first on Werever Outdoor Cabinets .",
    itemUrl: "https://werever.com/outdoor-kitchen-dimensions-how-much-space-do-you-need/",
    expected: ["Design & UX"],
    needsReview: true,
    note: "Outdoor kitchen layout marketing; Design vs none",
  },
  {
    id: "stored-aecbf361",
    source: "stored",
    feedTitle: "LongFence",
    feedDescription: "FAMILY OWNED SINCE 1945!",
    feedUrl: "https://www.longfence.com/feed",
    feedSiteUrl: "https://www.longfence.com/",
    sourceKind: "rss",
    itemTitle: "Top 3 Security Fencing Solutions to Protect Your Commercial Property",
    itemSummary:
      "Top 3 Security Fencing Solutions to Protect Your Commercial Property Investing in high-quality security fencing is fundamental to protecting your company’s staff, customers, and tangible assets. Chain link and ornamental fencing all each",
    itemContentText:
      "Top 3 Security Fencing Solutions to Protect Your Commercial Property Investing in high-quality security fencing is fundamental to protecting your company’s staff, customers, and tangible assets. Chain link and ornamental fencing all each have unique capabilities that suit different circumstances. Innovative automation tools further strengthen fences by providing greater controlover who can access your property and when they are able to do so. For every reputable business,",
    itemUrl:
      "https://www.longfence.com/blog/top-3-security-fencing-solutions-for-commercial-property/",
    expected: [],
    needsReview: true,
    note: "Physical security fencing marketing; not cybersecurity",
  },
  {
    id: "stored-aed0a6bf",
    source: "stored",
    feedTitle: "Amazing Women's World",
    feedDescription:
      "This Blog provides Truly about Fashion Designing Tutorials integration with YouTube Videos, Creative Fashion Designer Wears for both Women and Children's,Design It Yourself(DIY),",
    feedUrl: "https://amazingwomensworld.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://amazingwomensworld.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Very Grand & Elegant Design with Normal Stitching Needle-Same Like Aari...",
    itemSummary: null,
    itemContentText: null,
    itemUrl:
      "https://amazingwomensworld.blogspot.com/2021/08/very-grand-elegant-design-with-normal_27.html",
    expected: [],
  },
  {
    id: "stored-af356e64",
    source: "stored",
    feedTitle: "Metti International",
    feedDescription: "Vehicle Transport & Car Shipping",
    feedUrl: "https://mettiintl.com/feed",
    feedSiteUrl: "https://mettiintl.com/",
    sourceKind: "rss",
    itemTitle: "Things you should do when a carrier arrives to pick up your vehicle",
    itemSummary:
      "Things You Should Do When The Carrier Arrives When the carrier comes to collect your car, he will be filling out what is referred to as a Bill of Lading. Ensure you fill the Bill of Lading. This paper has a generic picture of vehicles and",
    itemContentText:
      "Things You Should Do When The Carrier Arrives When the carrier comes to collect your car, he will be filling out what is referred to as a Bill of Lading. Ensure you fill the Bill of Lading. This paper has a generic picture of vehicles and is used when he’s making his preliminary inspection. […] The post Things you should do when a carrier arrives to pick up your vehicle appeared first on Metti International .",
    itemUrl:
      "https://mettiintl.com/things-you-should-do-when-a-carrier-arrives-to-pick-up-your-vehicle/",
    expected: [],
  },
  {
    id: "stored-af91ec7d",
    source: "stored",
    feedTitle: "Spectro Cloud Feed",
    feedDescription:
      "Discover our blogs about all things Kubernetes. From bare metal to edge, learn tips and tricks for getting the most out of K8s at scale.",
    feedUrl: "https://www.spectrocloud.com/blog/rss.xml",
    feedSiteUrl: "https://www.spectrocloud.com/",
    sourceKind: "rss",
    itemTitle: "How the DPU is Powering GPU-Accelerated Infrastructure - Spectro Cloud",
    itemSummary:
      "DPUs like NVIDIA’s BlueField-3 are redefining modern infrastructure. Learn how Palette simplifies DPU-powered Kubernetes cluster deployment.",
    itemContentText:
      "DPUs like NVIDIA’s BlueField-3 are redefining modern infrastructure. Learn how Palette simplifies DPU-powered Kubernetes cluster deployment.",
    itemUrl: "https://www.spectrocloud.com/blog/why-the-dpu-era-is-the-next-gpu-moment",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-b0a01faa",
    source: "stored",
    feedTitle: "Harvest Law KC",
    feedDescription:
      "Discover Peace of Mind and Protect What You Love | Overland Park, KS Estate Planning",
    feedUrl: "https://harvestlawkc.com/feed",
    feedSiteUrl: "https://harvestlawkc.com/",
    sourceKind: "rss",
    itemTitle: "The Importance of Cybersecurity for Seniors",
    itemSummary:
      "As more financial, medical, and personal information moves online, protecting digital accounts through basic cybersecurity measures has become an important part of protecting the overall financial security of older adults.",
    itemContentText:
      "Everyone benefits from cybersecurity measures in the modern world. Americans no longer live in a purely analog world. They have not for a long time. Technology has expanded into every aspect, from communication to banking. Although anyone can fall victim to stolen passwords, compromised email accounts, or fraudulent messages, seniors are often prime targets. Scammers tend to exploit urgency and trust to access accounts. The results can be devastating and include identity",
    itemUrl: "https://harvestlawkc.com/the-importance-of-cybersecurity-for-seniors/",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-b0b8f355",
    source: "stored",
    feedTitle: "Personal Injury San Diego",
    feedDescription: "Your Source for Legal Injury Help",
    feedUrl: "https://www.personalinjurysandiego.org/feed",
    feedSiteUrl: "https://www.personalinjurysandiego.org/",
    sourceKind: "rss",
    itemTitle: "Motorcycle Accident Statute Of Limitations California",
    itemSummary:
      "The statute of limitations for a California motorcycle accident lawsuit is the deadline by which you must file your case in court — and missing it permanently eliminates your right to pursue compensation, regardless of how clear the",
    itemContentText:
      "The statute of limitations for a California motorcycle accident lawsuit is the deadline by which you must file your case in court — and missing it permanently eliminates your right to pursue compensation, regardless of how clear the liability or how serious the injuries. Most California motorcycle accident cases have a two-year filing deadline from the date of the crash. But several common scenarios — government entity involvement, discovery delays, injured minors, and",
    itemUrl:
      "https://www.personalinjurysandiego.org/practice-areas/motorcycle-accident-statute-of-limitations-california/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=motorcycle-accident-statute-of-limitations-california",
    expected: ["Politics & Policy"],
    needsReview: true,
    note: "Law-firm marketing on statute of limitations",
  },
  {
    id: "stored-b14dba01",
    source: "stored",
    feedTitle: "Phil's Food World",
    feedDescription: "Independent restaurant reviews, recipes and food features",
    feedUrl: "https://philsfoodworld.blogspot.com/feeds/posts/default",
    feedSiteUrl: "https://www.blogger.com/feeds/6381497082593646737/posts/default",
    sourceKind: "rss",
    itemTitle: "Review: Thundercat Pub and Diner, Glasgow",
    itemSummary:
      "Those of you who know me will be acutely aware of my love of ‘90s music. The recent announcement of an Oasis reunion has awoken our love of guitar music, just as the Manchester band did 30 years ago with their debut release, Definitely",
    itemContentText:
      "Those of you who know me will be acutely aware of my love of ‘90s music. The recent announcement of an Oasis reunion has awoken our love of guitar music, just as the Manchester band did 30 years ago with their debut release, Definitely Maybe. Watching live music in Glasgow is always a treat and, while Ride may not be the most obvious name that comes to mind from that era, they are one my favourite indie groups. With the prospect of several pints being sunk, we’d need",
    itemUrl: "https://www.blogger.com/feeds/6381497082593646737/posts/default/3933401473084028518",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-b1526115",
    source: "stored",
    feedTitle: "AC Toy Design",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://actoydesign.com/feed",
    feedSiteUrl: "https://actoydesign.com/",
    sourceKind: "rss",
    itemTitle: "Sergeant Kreel Custom Figure (6″ Star Wars Black Series)",
    itemSummary:
      "My 6″ Star Wars Black Series Sergeant Kreel custom figure commission. Below is a small gallery followed by the kitbash base and my sculpted details before paints. For a full galler, behind the scenes tutorial, and more consider supporting",
    itemContentText:
      "My 6″ Star Wars Black Series Sergeant Kreel custom figure commission. Below is a small gallery followed by the kitbash base and my sculpted details before paints. For a full galler, behind the scenes tutorial, and more consider supporting my Patreon! Join here: www.patreon.com/actoydesign Enjoy, and thanks for stopping by! AC",
    itemUrl:
      "https://actoydesign.com/2020/07/02/sergeant-kreel-custom-figure-6-star-wars-black-series/",
    expected: [],
    needsReview: true,
    note: "Custom action figure hobby; none vs Culture & Media",
  },
  {
    id: "stored-b1c2f1bf",
    source: "stored",
    feedTitle:
      "Historical Fiction Books, Essays, and Recommendations by Paul Jariabek on Historical Fiction of Paul Jariabek",
    feedDescription:
      "Paul Jariabek's historical fiction site featuring best historical fiction, epic naval adventures, book reviews, and flash fiction.",
    feedUrl: "https://jariabek.com/index.xml",
    feedSiteUrl: "https://jariabek.com/",
    sourceKind: "rss",
    itemTitle: "Sic Parvis Magna Sample Chapter—History of Hawkins",
    itemSummary:
      "I’m thrilled to share this early glimpse into my historical fiction novel. Please keep in mind that while this chapter is nearly complete, it may still include minor typos or be changed slightly before release. Your early interest means a",
    itemContentText:
      "I'm thrilled to share this early glimpse into my historical fiction novel. Please keep in mind that while this chapter is nearly complete, it may still include minor typos or be changed slightly before release. Your early interest means a great deal—thank you for taking this journey with me. If you enjoyed the read, please consider subscribing to my updates and posting about this on your social media. Midday light streamed through the tall, leaded glass window, casting",
    itemUrl:
      "https://jariabek.com/historical-fiction/books/adventures-of-francis-drake/sic-parvis-magna/history-of-hawkins/",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-b257e6e7",
    source: "stored",
    feedTitle: "GOODFUNDSADVISOR",
    feedDescription:
      "Wisdom, News, views, info, analysis from the WORLD OF INVESTMENTS to help you understand Investments. This content is for educational purposes only and should not be treated as investment advice.",
    feedUrl: "https://srikavimoney.blogspot.com/feeds/posts/default",
    feedSiteUrl: "https://www.blogger.com/feeds/1984785088200445741/posts/default",
    sourceKind: "rss",
    itemTitle: "INDIA's GDP BEAT JAPAN BUT MARKETS ARE EXPENSIVE SO HERE'S WHAT YOU SHOULD DO",
    itemSummary:
      "Congratulation friends, India has overtaken Japan to become 4th Largest economy in the World! But hold on to your celebrations. Before you start investing BIG into Indian Equities, better have a close look at the market valuations. And",
    itemContentText:
      "Congratulation friends, India has overtaken Japan to become 4th Largest economy in the World! But hold on to your celebrations. Before you start investing BIG into Indian Equities, better have a close look at the market valuations. And also question yourself, has India grown so fast to beat Japan or there are different factors in play? Lets explore.... Firstly we need to understand that Japan has been in stagflation for so many years now. In fact, Japan's GDP is now $4.0",
    itemUrl: "https://www.blogger.com/feeds/1984785088200445741/posts/default/4336409918293910116",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-b2b451f3",
    source: "stored",
    feedTitle: "JConcepts Blog",
    feedDescription: "Random Thoughts with a Drop of Knowledge",
    feedUrl: "https://blog.jconcepts.net/feed",
    feedSiteUrl: "https://blog.jconcepts.net/",
    sourceKind: "rss",
    itemTitle: "Race Team Update – August 2026 Week #4",
    itemSummary:
      "The JConcepts race team continues to stay red hot on tracks around the globe in the final weekend of racing in August. […]",
    itemContentText:
      "The JConcepts race team continues to stay red hot on tracks around the globe in the final weekend of racing in August. Read about what tracks we were winning at in this new edition of the Race Team Update! We start this week’s report out west in sunny California. Last weekend SDRC in San Diego held Round 2 of their Summer Series, and team driver Connor Esbeck competed in four classes with much success! 13.5 Stadium Truck = 1st place Expert 13.5 4wd Buggy = 1st place Expert",
    itemUrl: "https://blog.jconcepts.net/2026/09/race-team-update-august-2026-week-4/",
    expected: ["Sports"],
    needsReview: true,
    note: "RC car racing team update; Sports vs hobby",
  },
  {
    id: "stored-b3e86560",
    source: "stored",
    feedTitle: "The ADHD Blog",
    feedDescription:
      "Welcome to the new home of the blogs hosted by CHADD, the national resource on ADHD. We feature regular commentaries by CHADD leaders, ADHD experts, treatment professionals, educators, coaches,",
    feedUrl: "http://chaddleadershipblog.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://chaddleadershipblog.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Why Participate in ADHD Research?",
    itemSummary:
      "guest blog by Meghan Miller, PhD Adults and families affected by ADHD often ask this question. They may wonder if it’s really worth the effort or if their input will actually make a difference. It certainly does! Participation in research",
    itemContentText:
      "guest blog by Meghan Miller, PhD Adults and families affected by ADHD often ask this question. They may wonder if it’s really worth the effort or if their input will actually make a difference. It certainly does! Participation in research is important and crucial for three primary reasons: Participating in research offers a powerful way to make a difference in the lives of individuals affected by ADHD. It is the only way we can find new treatments and improve existing ones",
    itemUrl:
      "http://chaddleadershipblog.blogspot.com/2015/09/why-participate-in-adhd-research.html",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-b47d3b84",
    source: "stored",
    feedTitle: "TODAYSWORKPLACE",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://feeds.feedburner.com/todaysworkplace",
    feedSiteUrl: "https://www.todaysworkplace.org/",
    sourceKind: "rss",
    itemTitle: "Hello world!",
    itemSummary:
      "Welcome to WordPress. This is your first post. Edit or delete it, then start writing! The post Hello world! appeared first on TODAYSWORKPLACE .",
    itemContentText:
      "Welcome to WordPress. This is your first post. Edit or delete it, then start writing! The post Hello world! appeared first on TODAYSWORKPLACE .",
    itemUrl: "https://www.todaysworkplace.org/hello-world/",
    expected: [],
  },
  {
    id: "stored-b59d3fd6",
    source: "stored",
    feedTitle: "www.thecambodianews.net latest rss headlines",
    feedDescription:
      "Provides the latest rss feeds for www.thecambodianews.net. For more headlines on Breaking, National, Business, Finance, Sports and World News, visit our home page",
    feedUrl: "http://feeds.thecambodianews.net/rss/c7e1014a94f7e43b",
    feedSiteUrl: "http://www.thecambodianews.net/",
    sourceKind: "rss",
    itemTitle: "Cambodia, Myanmar sign 4 deals to boost bilateral cooperation",
    itemSummary:
      "PHNOM PENH, Sept. 11 (Xinhua) -- Cambodia and Myanmar signed four pacts on Friday to strengthen bilateral cooperation across trade, investment, culture, and media, Cambodian Prime Minister Hun Manet said. The signing ceremony took place at",
    itemContentText:
      "PHNOM PENH, Sept. 11 (Xinhua) -- Cambodia and Myanmar signed four pacts on Friday to strengthen bilateral cooperation across trade, investment, culture, and media, Cambodian Prime Minister Hun Manet said. The signing ceremony took place at the Peace Palace in Phnom Penh following a bilateral meeting between Hun Manet and visiting Myanmar President Min Aung Hlaing. According to a post on his social media p",
    itemUrl:
      "http://www.thecambodianews.net/news/279300704/cambodia-myanmar-sign-4-deals-to-boost-bilateral-cooperation",
    expected: ["World & Society"],
  },
  {
    id: "stored-b72fd7ff",
    source: "stored",
    feedTitle: "Delaware Way",
    feedDescription: "[email]; twitter.com/nannyfat",
    feedUrl: "http://delawareway.blogspot.com/feeds/posts/default",
    feedSiteUrl: "http://www.blogger.com/feeds/32087412/posts/default",
    sourceKind: "rss",
    itemTitle: "CLNCC Zoom Meeting Set Fpr 7PM Tuesday, January 21st - General Membership Meeting",
    itemSummary:
      "CLNCC Zoom Meeting Time : Tues day 7:00 PM January 21, 2025 Topics: General Membership Meeting Location: Zoom The CLNCC Zoom Meeting,7:00 Tues 21 Jan 2025, will be a General Membership Meeting. Join us live via zoom! ~ *~",
    itemContentText:
      "CLNCC Zoom Meeting Time : Tues day 7:00 PM January 21, 2025 Topics: General Membership Meeting Location: Zoom The CLNCC Zoom Meeting,7:00 Tues 21 Jan 2025, will be a General Membership Meeting. Join us live via zoom! ~ *~",
    itemUrl: "http://www.blogger.com/feeds/32087412/posts/default/5740114945244713002",
    expected: ["World & Society"],
    needsReview: true,
    note: "Community group meeting notice; could be none",
  },
  {
    id: "stored-b889ae5c",
    source: "stored",
    feedTitle: "PaleOMG",
    feedDescription: "Paleo, Lifestyle & Fitness Blog",
    feedUrl: "https://paleomg.com/feed",
    feedSiteUrl: "https://paleomg.com/",
    sourceKind: "rss",
    itemTitle: "Biostimulator Abs",
    itemSummary:
      "Today on the podcast, it’s me, myself and I talking about my recent trip to Carmel, California, the future of… The post Biostimulator Abs appeared first on PaleOMG .",
    itemContentText:
      "Today on the podcast, it’s me, myself and I talking about my recent trip to Carmel, California, the future of cosmetics, and the launch of Brian’s latest project! Listen on Apple Podcasts Listen on Spotify The post Biostimulator Abs appeared first on PaleOMG .",
    itemUrl: "https://paleomg.com/biostimulator-abs/",
    expected: [],
    needsReview: true,
    note: "Thin podcast blurb on travel and cosmetics",
  },
  {
    id: "stored-b8ac01e0",
    source: "stored",
    feedTitle: "Year of Polygamy",
    feedDescription: "The Story of Mormon Plural Marriage",
    feedUrl: "https://yearofpolygamy.com/feed",
    feedSiteUrl: "https://yearofpolygamy.com/",
    sourceKind: "rss",
    itemTitle: "Episode 129: Apostle vs. Apostle, the 1900-1920 Transition",
    itemSummary:
      "Join Lindsay as she interviews Bryan Buchanan from Benchmark Books about the post-manifesto marriage period and the conflict it created among the LDS Quorum of the Twelve. Links mentioned in this podcast: Email Bryan Buchanan BENCHMARK",
    itemContentText:
      "Join Lindsay as she interviews Bryan Buchanan from Benchmark Books about the post-manifesto marriage period and the conflict it created among the LDS Quorum of the Twelve. Links mentioned in this podcast: Email Bryan Buchanan BENCHMARK BOOKS LDS BOOKS: NEW, USED [&#8230;]",
    itemUrl:
      "https://yearofpolygamy.com/uncategorized/episode-129-apostle-vs-apostle-the-1900-1920-transition/",
    expected: ["World & Society"],
    needsReview: true,
    note: "LDS polygamy history podcast; religion/history fit",
  },
  {
    id: "stored-b8ee7b82",
    source: "stored",
    feedTitle: "Beki's Loose Threads",
    feedDescription: "Life, creativity & whatever else is on Beki's mind",
    feedUrl: "http://bekihaley.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://bekihaley.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "A Brand New Forest",
    itemSummary:
      "I am blessed to live in Northern California! Within less than an hour drive I can be gazing up at Giant Redwoods. I can hear the Pacific crash against jagged rocks, or hear it gently flow to shore over a beautiful sandy beach. I can be in",
    itemContentText:
      "I am blessed to live in Northern California! Within less than an hour drive I can be gazing up at Giant Redwoods. I can hear the Pacific crash against jagged rocks, or hear it gently flow to shore over a beautiful sandy beach. I can be in a major city (San Francisco) to enjoy an opera, world class dining, a Giants ball game, visit historical landmarks. I can be driving across rolling golden hills on my way to a babbling stream high up in the mountains. I am basically",
    itemUrl: "http://bekihaley.blogspot.com/2012/04/brand-new-forest.html",
    expected: ["Personal & Essays"],
  },
  {
    id: "stored-b941da38",
    source: "stored",
    feedTitle: "PESTLE Analysis",
    feedDescription:
      "We help thousands of business analysts, students, and managers craft better analysis every day.",
    feedUrl: "https://pestleanalysis.com/rss",
    feedSiteUrl: "https://pestleanalysis.com/",
    sourceKind: "rss",
    itemTitle: "The Operating Cost Most Manufacturers Underestimate — and Why Strategy Should Care",
    itemSummary:
      "Strategy tends to fixate on the visible numbers: headcount, raw materials, the price of the machine on the purchase order. The costs that quietly compound in the background rarely make it onto a slide. Compressed air is the textbook",
    itemContentText:
      'Strategy tends to fixate on the visible numbers: headcount, raw materials, the price of the machine on the purchase order. The costs that quietly compound in the background rarely make it onto a slide. Compressed air is the textbook example. It powers a huge share of industrial activity — tools, actuators, packaging, automation — yet it almost never gets analyzed as a strategic line item. It\'s filed under "facilities," shrugged at, and forgotten until something breaks.',
    itemUrl:
      "https://pestleanalysis.com/operating-cost-most-manufacturers-underestimate-why-strategy-care/",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-ba088807",
    source: "stored",
    feedTitle: "Blog - Community Voices for Public Education",
    feedDescription: "Here's the blog for Community Voices for Public Education",
    feedUrl: "https://www.houstoncvpe.org/blog.rss",
    feedSiteUrl: "http://www.houstoncvpe.org/blog",
    sourceKind: "rss",
    itemTitle: "Stand Up for Our Kids and Teachers This Saturday",
    itemSummary:
      "How do good educators and school leaders go to bed at night without shame? Here is the rule they live by. If it helps the child and also improves the school's rating, do it. But if it boosts the rating while hurting the child, don't do it.",
    itemContentText:
      "How do good educators and school leaders go to bed at night without shame? Here is the rule they live by. If it helps the child and also improves the school's rating, do it. But if it boosts the rating while hurting the child, don't do it. That's the rule to live by. Children must always come before data. Every time",
    itemUrl: "http://www.houstoncvpe.org/stand_up_for_our_kids_and_teachers_this_saturday",
    expected: ["Education & Work"],
  },
  {
    id: "stored-bacf4418",
    source: "stored",
    feedTitle: "Thurman Design Studio",
    feedDescription: "Full Service Interior Design",
    feedUrl: "https://www.thurmandesignstudio.com/blog-feed.xml",
    feedSiteUrl: "https://www.thurmandesignstudio.com/blog-old",
    sourceKind: "rss",
    itemTitle: "Remote Office Design",
    itemSummary:
      "Learn how I design remote offices that improve focus, comfort, and productivity. From furniture to small space solutions, create a home office you will love.",
    itemContentText:
      "When I design a remote office, I always remind clients that it is more than a desk and chair. Your workspace should support the way you think, create, and stay organized. The goal is not just to look good but to actually make your day feel smoother, lighter, and more productive. I have learned over time that even small changes can have a BIG impact. That is why I always approach home offices with equal parts function and style. Create a WFH Space That Helps You Focus The",
    itemUrl: "https://www.thurmandesignstudio.com/post/remote-office-design",
    expected: ["Design & UX"],
  },
  {
    id: "stored-bb3d7787",
    source: "stored",
    feedTitle: "The Short Mystery Fiction Society Blog",
    feedDescription: "From the group keeping mystery & crime stories in the public eye since 1996",
    feedUrl: "https://shortmystery.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://shortmystery.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Ain't That Good News? Hot New Reads from the Short Mystery Fiction Society!",
    itemSummary:
      "As spring turns the corner into summer, 2026 continues to heat up with a wealth of exciting offerings from the writers of the Short Mystery Fiction Society. SMFS means quality! And remember, if you read something you enjoy--from this list",
    itemContentText:
      "As spring turns the corner into summer, 2026 continues to heat up with a wealth of exciting offerings from the writers of the Short Mystery Fiction Society. SMFS means quality! And remember, if you read something you enjoy--from this list or anywhere else--support the writers with ratings and reviews at your favorite websites. Help other readers find the stories you love--stories like these! The Derringer Awards, given annually by the members of SMFS, have been recognizing",
    itemUrl:
      "https://shortmystery.blogspot.com/2026/05/aint-that-good-news-hot-new-reads-from.html",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-bb86d940",
    source: "stored",
    feedTitle: "Blog - Palermo Street Food",
    feedDescription:
      "The Palermo Street Food Blog is your place to read about what's going on and what everyone is eating in the streets of Palermo.",
    feedUrl: "https://www.palermostreetfood.com/blog?format=RSS",
    feedSiteUrl: "https://www.palermostreetfood.com/blog/",
    sourceKind: "rss",
    itemTitle: 'The Strange History of the "Bad" Palermitan Women',
    itemSummary:
      "Corso Vittorio Emanuele is the long avenue that divides Palermo in two and ends at a large stone gate, Porta Felice. Crossing it you will find the Foro Italico with its sea views. But if instead of crossing it you look at the stairs right",
    itemContentText:
      "Corso Vittorio Emanuele is the long avenue that divides Palermo in two and ends at a large stone gate, Porta Felice. Crossing it you will find the Foro Italico with its sea views. But if instead of crossing it you look at the stairs right next to Porta Felice you can climb them, go through an iron gate and walk along what were originally the city walls. You will be walking on the Mure delle Cattive. If you know any Italian, you'll know that “cattive” is the feminine plural",
    itemUrl:
      "https://www.palermostreetfood.com/blog/2023/10/10/the-strange-history-of-the-bad-palermitan-women",
    expected: ["Food & Travel"],
    needsReview: true,
    note: "Palermo local history; Travel vs Culture",
  },
  {
    id: "stored-bce02873",
    source: "stored",
    feedTitle: "90min EN Feed",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.90min.com/posts.rss",
    feedSiteUrl: "https://www.90min.com/",
    sourceKind: "rss",
    itemTitle: "Spain's 2026 World Cup home kit leaked",
    itemSummary:
      "Spain’s 2026 World Cup home kit has leaked online, featuring deep red, navy sleeves, and yellow pinstripes in a nod to tradition.",
    itemContentText:
      "Spain’s 2026 World Cup home kit has leaked online, featuring deep red, navy sleeves, and yellow pinstripes in a nod to tradition.",
    itemUrl: "https://www.90min.com/spain-2026-world-cup-home-kit-leaked?utm_source=RSS",
    expected: ["Sports"],
  },
  {
    id: "stored-bd57067b",
    source: "stored",
    feedTitle: "The SHARED Space",
    feedDescription:
      "Learn about the ins and outs of real estate and single-family rental home investing with our blog post series. From market trends to tips and tricks, we've got you covered!",
    feedUrl: "https://blog.sharesfr.com/rss.xml",
    feedSiteUrl: "https://blog.sharesfr.com/",
    sourceKind: "rss",
    itemTitle: "The U.S.-Canada Tariffs Impact on Cross-Border Real Estate Investors",
    itemSummary:
      "Recent discussions about potential tariffs between the U.S. and Canada have sparked concerns across multiple industries. While these trade policies primarily affect goods and manufacturing, they can also create ripple effects that",
    itemContentText:
      "Recent discussions about potential tariffs between the U.S. and Canada have sparked concerns across multiple industries. While these trade policies primarily affect goods and manufacturing, they can also create ripple effects that indirectly influence real estate markets. For Canadians investing in U.S. rental properties, understanding these potential impacts is key to making informed decisions.",
    itemUrl: "https://blog.sharesfr.com/tariffs-canada",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-be3d3fe7",
    source: "stored",
    feedTitle: "Yeastar Blog - Product Updates and Tips about Easy Communication",
    feedDescription: "VoIP PBX Phone Systems",
    feedUrl: "https://www.yeastar.com/category/blog/feed",
    feedSiteUrl: "https://www.yeastar.com/it/category/blog/",
    sourceKind: "rss",
    itemTitle:
      "P-Series V25.2 BETA Updates: Improved Linkus Mobile UX, Enhanced Message Interaction, More",
    itemSummary:
      "P-Series Phone System V25.2 focuses on improvements across mobile use experience, message interaction, call routing flexibility, and customer service continuity. Core updates include: Feature Summary Configuration Guide Improved Linkus",
    itemContentText:
      "P-Series Phone System V25.2 focuses on improvements across mobile use experience, message interaction, call routing flexibility, and customer service continuity. Core updates include: Feature Summary Configuration Guide Improved Linkus Mobile UX A smoother Linkus mobile experience with customizable navigation… The post P-Series V25.2 BETA Updates: Improved Linkus Mobile UX, Enhanced Message Interaction, More appeared first on Yeastar .",
    itemUrl: "https://www.yeastar.com/blog/p-series-v252-beta/",
    expected: ["Technology"],
  },
  {
    id: "stored-be457123",
    source: "stored",
    feedTitle: "Aeliya Marine Tech - Updates",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://aeliyamarinetech.com/blogs/updates.atom",
    feedSiteUrl: "https://aeliyamarinetech.com/blogs/updates",
    sourceKind: "rss",
    itemTitle: "ABB ACW6441390600000300900 ACS600 Module for High-Performance Applications",
    itemSummary:
      "✓ 30-Day Warranty | ✓ Free Shipping View Product The ABB ACW6441390600000300900 ACS600 Multidrive Module is a high-capacity industrial drive solution that features an advanced dual-component architecture integrating both the Ngdr-03C gate",
    itemContentText:
      "✓ 30-Day Warranty | ✓ Free Shipping View Product The ABB ACW6441390600000300900 ACS600 Multidrive Module is a high-capacity industrial drive solution that features an advanced dual-component architecture integrating both the Ngdr-03C gate driver and Nxpp-03C control component . This powerful variable frequency drive module delivers an exceptional 4300A/1156A output current with precise frequency control from 0 to 300 Hz, establishing it as a premier choice for the most",
    itemUrl:
      "https://aeliyamarinetech.com/blogs/updates/abb-acw6441390600000300900-acs600-drive-module",
    expected: [],
  },
  {
    id: "stored-be86356e",
    source: "stored",
    feedTitle: "FALL Archives - StoneGable",
    feedDescription: "Heart of Home Inspiration",
    feedUrl: "https://stonegableblog.com/category/fall-decorating/feed",
    feedSiteUrl: "https://stonegableblog.com/category/fall-decorating/",
    sourceKind: "rss",
    itemTitle: "The Smart Girl’s Guide To Easy Fall Decorating + 4-Week Printable Planning Guide",
    itemSummary:
      "Not sure when to start decorating for fall? This simple four-week timeline breaks it into easy, doable steps so your home eases into the season without any overwhelm. So when should you really start decorating for fall? For most of us, it",
    itemContentText:
      "Not sure when to start decorating for fall? This simple four-week timeline breaks it into easy, doable steps so your home eases into the season without any overwhelm. So when should you really start decorating for fall? For most of us, it comes down to personal timing rather than a rule. If you like to... The post The Smart Girl’s Guide To Easy Fall Decorating + 4-Week Printable Planning Guide appeared first on StoneGable .",
    itemUrl: "https://stonegableblog.com/fall-decorating-timeline/",
    expected: [],
    needsReview: true,
    note: "Home decorating how-to; none vs Design & UX",
  },
  {
    id: "stored-bed1c0a2",
    source: "stored",
    feedTitle: "Linda Newman's Family Tree",
    feedDescription: "Information on my family tree and my family history research.",
    feedUrl: "http://linda-family-tree.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://linda-family-tree.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Frederick Charles Newman, come out, come out wherever you are!",
    itemSummary:
      "Frederick Charles Newman, come out, come out wherever you are! Seems he disappeared after 1891, or at least I can't find him after that point.... So I am looking for descendants of: George Newman (b 1822 Chelmsford, Essex, England d 1868",
    itemContentText:
      "Frederick Charles Newman, come out, come out wherever you are! Seems he disappeared after 1891, or at least I can't find him after that point.... So I am looking for descendants of: George Newman (b 1822 Chelmsford, Essex, England d 1868 Chelmsford, Essex, England He was a Printer/Composter) and Mary Ann Bridge (b 1834 Essex, Southminister, England d 1911Chelmsford, Essex, England). To my knowledge Mary Ann Bridge and George Newman had 5 children all born in Chelmsford, the",
    itemUrl:
      "http://linda-family-tree.blogspot.com/2022/04/frederick-charles-newman-come-out-come.html",
    expected: ["Personal & Essays"],
    needsReview: true,
    note: "Genealogy hobby post; could be none",
  },
  {
    id: "stored-c0f9d4e1",
    source: "stored",
    feedTitle: "Al-Alhambra Book Reviews",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://alalhambrabookreviews.home.blog/feed",
    feedSiteUrl: "https://alalhambrabookreviews.home.blog/",
    sourceKind: "rss",
    itemTitle: "Untitled item 4",
    itemSummary:
      "The Eye of Leviathan by M. A. Carrick Synopsis: Description From the author of The Mask of Mirrors comes a sweeping adventure set in a world where fae secretly walk amongst those who seek to persecute them. In an alternate Spanish Golden",
    itemContentText:
      "The Eye of Leviathan by M. A. Carrick Synopsis: Description From the author of The Mask of Mirrors comes a sweeping adventure set in a world where fae secretly walk amongst those who seek to persecute them. In an alternate Spanish Golden Age, the Council of the Sea Beyond has risen to unrivalled power, exploiting the Otherworld’s most precious resources for their own gain. Estevan seeks to uncover their secrets, but he risks the exposure of his own: that he is a faerie,",
    itemUrl: "https://alalhambrabookreviews.home.blog/2026/07/01/2979/",
    expected: ["Culture & Media"],
  },
  {
    id: "stored-c1044975",
    source: "stored",
    feedTitle: "Muaythai-World.com",
    feedDescription: "Muay Thai. MMA. Kickboxing.",
    feedUrl: "https://muaythai-world.com/feed",
    feedSiteUrl: "https://muaythai-world.com/",
    sourceKind: "rss",
    itemTitle: "The Trainers at Tiger Muay Thai Phuket",
    itemSummary:
      "Tiger Muay Thai Instructors – Within the vibrant setting of the Tiger Muay Thai Camp in Phuket, a diverse group of exceptional Muay Thai trainers awaits you, ready to impart the intricacies of this martial art. Among them are accomplished",
    itemContentText:
      "Tiger Muay Thai Instructors – Within the vibrant setting of the Tiger Muay Thai Camp in Phuket, a diverse group of exceptional Muay Thai trainers awaits you, ready to impart the intricacies of this martial art. Among them are accomplished fighters, boasting victories in numerous tournaments and earning prestigious medals. Today, their primary mission is [...] Der Beitrag The Trainers at Tiger Muay Thai Phuket erschien zuerst auf Muaythai-World.com .",
    itemUrl: "https://muaythai-world.com/the-trainers-at-tiger-muay-thai/",
    expected: ["Sports"],
  },
  {
    id: "stored-c1188852",
    source: "stored",
    feedTitle: "Blogs - Mind-Design Sports",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.mind-designsports.org/blogs?format=rss",
    feedSiteUrl: "https://www.mind-designsports.org/blogs/",
    sourceKind: "rss",
    itemTitle: "Nurturing Your Well-Being: 8 Practical Tips for a Healthier Life",
    itemSummary:
      "Discover how to reclaim your well-being in a busy world. We dive into tips that will help you detoxify your life, embrace gratitude, and find joy in hobbies. Whether you’re advancing your career with flexible online degrees, volunteering",
    itemContentText:
      "In our fast-paced world, prioritizing long-term wellness can sometimes take a back seat to the demands of daily life. However, maintaining good health and overall well-being is crucial for a fulfilling and vibrant existence. In this article, we will explore nine actionable tips that can help you foster a healthier and more balanced life. Limit Exposure to Toxins Take proactive steps to reduce unnecessary exposure to toxins and pollutants . Consider using natural cleaning",
    itemUrl:
      "https://www.mind-designsports.org/blogs/nurturing-your-well-being-8-practical-tips-for-a-healthier-life",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-c2b3a60b",
    source: "stored",
    feedTitle: "IAM (Identity And Access Management) Best Practices And Trends",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.forrester.com/blogs/category/iam-identity-access-management/feed",
    feedSiteUrl: "https://www.forrester.com/blogs/category/iam-identity-access-management/",
    sourceKind: "rss",
    itemTitle: "Microsoft Makes Passkeys Default: What Identity And Security Leaders Need To Do",
    itemSummary:
      "Microsoft’s decision to make passkeys the default authentication method in Entra ID signals a broader industry shift: phishing-resistant authentication is no longer optional. Identity and security leaders should use this moment to",
    itemContentText:
      "Microsoft’s July 2026 announcement that passkeys will become the default authentication method for all users in Microsoft Entra ID is a clear inflection point for phishing-resistant MFA adoption. Beginning September 1, 2026, Microsoft will automatically enable passkeys for users currently relying on SMS or voice authentication, and by February 1, 2027, Microsoft will retire its native SMS and voice authentication services entirely. For years, organizations have viewed",
    itemUrl:
      "https://www.forrester.com/blogs/microsoft-makes-passkeys-default-what-identity-and-security-leaders-need-to-do/",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-c2b6c1c6",
    source: "stored",
    feedTitle: "Backcountry Skiing Archives - Gaia GPS",
    feedDescription: "Navigate, Track, and Explore",
    feedUrl: "https://blog.gaiagps.com/category/backcountry-skiing/feed",
    feedSiteUrl: "https://blog.gaiagps.com/category/backcountry-skiing/",
    sourceKind: "rss",
    itemTitle: "How to Plan a Backcountry Ski Tour with Gaia GPS",
    itemSummary:
      "From planning your route to navigating in the field, Gaia GPS can take your backcountry skiing to the next level. Gaia GPS Group Product Manager and avid backcountry splitboarder Devin Lehman demystifies the process. Join him for a tour of",
    itemContentText:
      "Devin Lehman is the Product Manager for Gaia GPS. Join him in planning and going on a backcountry ski tour, and to learn how to use Gaia GPS for your winter backcountry excursions. I’m a backcountry snowboarder who happens to work in tech. It’s a lame joke I’ve told coworkers over the past decade. (And it’s a joke that needs no explanation to my coworkers at Gaia GPS.) So when winter swung into central Oregon and the avalanche forecast looked promising, I jumped on the",
    itemUrl: "https://blog.gaiagps.com/how-to-plan-a-backcountry-ski-tour/",
    expected: ["Sports", "Technology"],
    needsReview: true,
    note: "Backcountry ski tour planning via GPS app",
  },
  {
    id: "stored-c35fbc83",
    source: "stored",
    feedTitle: "Chen-Xi Education @ Hillview",
    feedDescription: "Specialized physics tutoring services to help you ace your physics exams",
    feedUrl: "https://www.ace-physics.com/blog-feed.xml",
    feedSiteUrl: "https://www.ace-physics.com/physics-blog",
    sourceKind: "rss",
    itemTitle: "Detailed Solutions for AP Physics C Mechanics 2024 FRQ paper",
    itemSummary:
      "Hi, all. The AP exams are coming in May 2025! We all feel the stress now. Many students find it very hard to solve the real AP questions...",
    itemContentText:
      "Hi, all. The AP exams are coming in May 2025! We all feel the stress now. Many students find it very hard to solve the real AP questions...",
    itemUrl:
      "https://www.ace-physics.com/post/detailed-solutions-for-ap-physics-c-mechanics-2024-frq-paper",
    expected: ["Education & Work"],
  },
  {
    id: "stored-c403a8ae",
    source: "stored",
    feedTitle: "Hedge funds",
    feedDescription: "Hedge funds",
    feedUrl: "https://www.ft.com/hedge-funds?format=rss",
    feedSiteUrl: "https://www.ft.com/stream/a02ea563-eb16-4e49-af97-a1e3aa351677",
    sourceKind: "rss",
    itemTitle: "Citadel’s flagship fund surges 6% after Situational Awareness swoop",
    itemSummary:
      "Ken Griffin’s company bought billions of dollars of AI stocks from Leopold Aschenbrenner’s firm",
    itemContentText:
      "Ken Griffin’s company bought billions of dollars of AI stocks from Leopold Aschenbrenner’s firm",
    itemUrl: "https://www.ft.com/content/ae7acfa8-32d6-496a-a1df-28206fa1661d?syn-25a6b1a6=1",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-c43084b2",
    source: "stored",
    feedTitle: "Frogs and Reptiles News -- ScienceDaily",
    feedDescription:
      "Snakes, lizards, alligators, frogs and toads. From habitat information to frogs in stem cell research, you will find all the reptile and amphibian news here.",
    feedUrl: "https://www.sciencedaily.com/rss/plants_animals/frogs_and_reptiles.xml",
    feedSiteUrl: "https://www.sciencedaily.com/news/plants_animals/frogs_and_reptiles/",
    sourceKind: "rss",
    itemTitle: "Wasps are disappearing this summer, and scientists are worried",
    itemSummary:
      "Britain’s wasps have become mysteriously scarce this summer, and scientists suspect an unusual combination of temperature swings, heatwaves, and food shortages may be responsible. Even the wasps that remain appear unusually small,",
    itemContentText:
      "Britain’s wasps have become mysteriously scarce this summer, and scientists suspect an unusual combination of temperature swings, heatwaves, and food shortages may be responsible. Even the wasps that remain appear unusually small, potentially offering a glimpse of how extreme heat could reshape insect populations.",
    itemUrl: "https://www.sciencedaily.com/releases/2026/09/260911003901.htm",
    expected: ["Science & Research", "Climate & Environment"],
  },
  {
    id: "stored-c4a7cf6a",
    source: "stored",
    feedTitle: "STEM-Talk",
    feedDescription: "The most interesting people in the world of science and technology",
    feedUrl: "https://www.ihmc.us/stemtalk/feed/podcast",
    feedSiteUrl: "https://www.ihmc.us/stemtalk/",
    sourceKind: "rss",
    itemTitle:
      "Episode 20: Dr. Alessio Fasano discusses the gut microbiome and how it affects our health",
    itemSummary:
      "When Alessio Fasano entered medical school at the University of Naples (Italy) School of Medicine, his goal was to eliminate childhood diarrhea. Working with a mentor who’d studied the physiology of the gut, Fasano decided to focus on the",
    itemContentText:
      "When Alessio Fasano entered medical school at the University of Naples (Italy) School of Medicine, his goal was to eliminate childhood diarrhea. Working with a mentor who’d studied the physiology of the gut, Fasano decided to focus on the microorganisms that cause diarrhea. That opened up his world to specialize in overall gut health, and Fasano became a leading expert in celiac disease and gluten-related disorders. Following medical school, Fasano spent three years at the",
    itemUrl: "https://www.ihmc.us/stemtalk/episode-20/",
    expected: ["Health & Medicine", "Science & Research"],
  },
  {
    id: "stored-c5227ebd",
    source: "stored",
    feedTitle: "Google | The Verge",
    feedDescription:
      "The Verge is about technology and how it makes us feel. Founded in 2011, we offer our audience everything from breaking news to reviews to award-winning features and investigations, on our site, in",
    feedUrl: "https://www.theverge.com/rss/google/index.xml",
    feedSiteUrl: "https://www.theverge.com/google",
    sourceKind: "rss",
    itemTitle: "Google says its AI weather model is getting better",
    itemSummary:
      "Google is rolling out an updated AI weather model that's supposed to be more accurate, especially when it comes to predicting rain and snowfall. In the announcement today, the company says it's now able to make forecasts with",
    itemContentText:
      "Google is rolling out an updated AI weather model that's supposed to be more accurate, especially when it comes to predicting rain and snowfall. In the announcement today, the company says it's now able to make forecasts with \"unprecedented resolution\" using its new WeatherNext 3 AI model. It can produce a global picture that's five times sharper than Google's previous model by learning from real-time weather observations, according to the company. \"One of the main",
    itemUrl:
      "https://www.theverge.com/tech/988921/weather-forecast-ai-model-google-satellite-update",
    expected: ["AI & ML"],
  },
  {
    id: "stored-c52e882f",
    source: "stored",
    feedTitle: "Circular Economy - Waste Advantage Magazine",
    feedDescription:
      "Waste Advantage Magazine is solely dedicated to covering the solid waste and recycling industry with one publication and one price.",
    feedUrl: "https://wasteadvantagemag.com/circular-economy/feed",
    feedSiteUrl: "https://wasteadvantagemag.com/circular-economy/",
    sourceKind: "rss",
    itemTitle: "Circular Solutions to Verify Recycling at Indianapolis 500",
    itemSummary:
      "The Indianapolis 500 is known for speed, precision, and scale. Approximately 350,000 fans gather at Indianapolis Motor Speedway each year, making it the largest single-day sporting event in the world. […]",
    itemContentText:
      "The Indianapolis 500 is known for speed, precision, and scale. Approximately 350,000 fans gather at Indianapolis Motor Speedway each year, making it the largest single-day sporting event in the world. [&#8230;]",
    itemUrl:
      "https://wasteadvantagemag.com/circular-solutions-to-verify-recycling-at-indianapolis-500/",
    expected: ["Climate & Environment"],
  },
  {
    id: "stored-c5abac8f",
    source: "stored",
    feedTitle: "TechGliding - Tech From The Top",
    feedDescription:
      "TechGliding is a technology website where you can read more and more awesome articles on tech, apps, business, marketing, etc. We want you to look at the Tech From the Top!",
    feedUrl: "https://www.techgliding.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://www.techgliding.com/",
    sourceKind: "rss",
    itemTitle: "Smarter Campaigns, Better Conversions: What AI in Marketing Really Delivers",
    itemSummary:
      "Marketing has always been about two things: reaching the right people and convincing them to act. Today, artificial intelligence is changing how both goals are achieved - not by replacing strategy, but by making campaigns smarter, faster,",
    itemContentText:
      "Marketing has always been about two things: reaching the right people and convincing them to act. Today, artificial intelligence is changing how both goals are achieved - not by replacing strategy, but by making campaigns smarter, faster, and more effective. This blog explores the tangible impact of AI in marketing solutions, highlighting where it drives the greatest value, real-world outcomes, and more. Where does AI have the Biggest, Provable Impact? 1. Faster, sharper",
    itemUrl: "https://www.techgliding.com/2026/01/what-ai-in-marketing-delivers.html",
    expected: ["AI & ML", "Business & Startups"],
  },
  {
    id: "stored-c6435509",
    source: "stored",
    feedTitle: "Best Ultrasonic Cleaner Blog",
    feedDescription:
      "A blog for our Best Ultrasonic Cleaner website. Lots of help, guides, and information on ultrasonic cleaning of carburetors, dental instruments, and more! Best Ultrasonic Cleaners are professional",
    feedUrl: "https://best-ultrasonic-cleaner.blog/feed",
    feedSiteUrl: "https://best-ultrasonic-cleaner.blog/",
    sourceKind: "rss",
    itemTitle: "Our “Best Ultrasonic Cleaner” own brand of ultrasonic tanks.",
    itemSummary:
      "Introducing our own brand of ultrasonic cleaners. Discover why our best ultrasonic cleaner is the top choice for quality and reliability. With years of experience in the industry, we have taken a bold step and now proudly present our own",
    itemContentText:
      'Introducing our own brand of ultrasonic cleaners. Discover why our best ultrasonic cleaner is the top choice for quality and reliability. With years of experience in the industry, we have taken a bold step and now proudly present our own branded range of ultrasonic cleaners into the UK. As experts in the field, we understand … Continue reading "Our “Best Ultrasonic Cleaner” own brand of ultrasonic tanks." The post Our “Best Ultrasonic Cleaner” own brand of ultrasonic tanks.',
    itemUrl:
      "https://best-ultrasonic-cleaner.blog/2024/05/15/our-best-ultrasonic-cleaner-own-brand-of-ultrasonic-tanks/",
    expected: [],
  },
  {
    id: "stored-c66b0ad2",
    source: "stored",
    feedTitle: "Live Scores, Latest Sports News, Results, Cricket Updates | The Hindu",
    feedDescription:
      "Stay Up To Date With The Latest Sports News & Updates From The World Of Cricket, Football, Tennis, Badminton & Much More At The Hindu",
    feedUrl: "https://www.thehindu.com/sport/feeder/default.rss",
    feedSiteUrl: "https://www.thehindu.com/sport/",
    sourceKind: "rss",
    itemTitle: "Sarthak leads Petronas TVS Racing’s podium sweep",
    itemSummary: null,
    itemContentText: null,
    itemUrl:
      "https://www.thehindu.com/sport/motorsport/sarthak-chavan-leads-petronas-tvs-racings-podium-sweep/article71460212.ece",
    expected: ["Sports"],
  },
  {
    id: "stored-c70ae105",
    source: "stored",
    feedTitle: "Tress Academic",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://tressacademic.com/feed",
    feedSiteUrl: "https://tressacademic.com/",
    sourceKind: "rss",
    itemTitle: "#155: How to Structure a Research Paper: A Simple Template That Works",
    itemSummary:
      "You have the research. You have data, notes, maybe even draft text. You have spent weeks or months working on the project. Yet when you try to turn all of this into a paper, something does not quite come together. Sections feel unclear,",
    itemContentText:
      "You have the research. You have data, notes, maybe even draft text. You have spent weeks or months working on the project. Yet when you try to turn all of this into a paper, something does not quite come together. Sections feel unclear, ideas overlap, and the structure never quite works. This is one of the most common challenges in academic writing. In many cases, the difficulty is not the… Source",
    itemUrl: "https://tressacademic.com/research-paper-structure/",
    expected: ["Education & Work"],
  },
  {
    id: "stored-c8ef681d",
    source: "stored",
    feedTitle: "Chemistry News - Biochemistry, Polymers, Materials Science",
    feedDescription:
      "The latest news stories on chemistry, biochemistry, polymers, materials science from Phys.org",
    feedUrl: "https://phys.org/rss-feed/chemistry-news",
    feedSiteUrl: "https://phys.org/chemistry-news/",
    sourceKind: "rss",
    itemTitle:
      "Electrochemical system extracts pure hydrogen from ammonia at substantially lower temperatures",
    itemSummary:
      "As a liquid that is easily stored and transported, ammonia (NH3) is an attractive carrier for hydrogen, which is used in fuel cells, semiconductor manufacturing, chemical processing and other applications. However, breaking ammonia into",
    itemContentText:
      "As a liquid that is easily stored and transported, ammonia (NH3) is an attractive carrier for hydrogen, which is used in fuel cells, semiconductor manufacturing, chemical processing and other applications. However, breaking ammonia into hydrogen and nitrogen typically requires high temperatures, and the resulting gas mixture must undergo additional purification before the hydrogen can be used in many applications.",
    itemUrl:
      "https://phys.org/news/2026-09-electrochemical-pure-hydrogen-ammonia-substantially.html",
    expected: ["Science & Research"],
  },
  {
    id: "stored-c9a3c406",
    source: "stored",
    feedTitle: "JMRush Designs",
    feedDescription:
      "These designs and more can be found at Silhouettedesignstore.com and jamieandjenn.com",
    feedUrl: "http://jmrushdesigns.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "http://jmrushdesigns.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Horseshoe Star Gift Tag Ornament",
    itemSummary:
      "Horseshoe Star Gift Tag Ornament-JMR Approximate size: H 5” X W 4.75” This Horseshoe Star design doubles as a gift tag and ornament and is compatible with both 8X12 and 12X12 mats. You can purchase the Silhouette design file here:",
    itemContentText:
      "Horseshoe Star Gift Tag Ornament-JMR Approximate size: H 5” X W 4.75” This Horseshoe Star design doubles as a gift tag and ornament and is compatible with both 8X12 and 12X12 mats. You can purchase the Silhouette design file here: https://www.silhouettedesignstore.com/artists/485222 You can purchase the SVG and Cricut compatible file here:https:// www.jamieandjenn.com Coming Soon:) Cut the design pieces. I used double sided card stock. Glue the dark greenery to the",
    itemUrl: "http://jmrushdesigns.blogspot.com/2022/11/horseshoe-star-gift-tag-ornament.html",
    expected: [],
  },
  {
    id: "stored-c9f732fd",
    source: "stored",
    feedTitle: "Cloud Administrator",
    feedDescription: "Begin Your Azure Management Journey with the Cloud Administrator",
    feedUrl: "https://cloudadministrator.net/feed",
    feedSiteUrl: "https://cloudadministrator.net/",
    sourceKind: "rss",
    itemTitle: "[Cross-Post] How To Detect And Protect Yourself From WannaCry",
    itemSummary:
      "Make sure to check out this blog post that I’ve wrote on my company’s web site. How To Detect And Protect Yourself From WannaCry",
    itemContentText:
      "Make sure to check out this blog post that I’ve wrote on my company’s web site. How To Detect And Protect Yourself From WannaCry",
    itemUrl:
      "https://cloudadministrator.net/2017/05/24/cross-post-how-to-detect-and-protect-yourself-from-wannacry/",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-ca9fb685",
    source: "stored",
    feedTitle: "Blog - Good Law Group",
    feedDescription: "Social Security Disability Lawyers",
    feedUrl: "https://www.thegoodlawgroup.com/blog/feed",
    feedSiteUrl: "https://www.thegoodlawgroup.com/blog/",
    sourceKind: "rss",
    itemTitle: "How Cancer Survivors Can Qualify for Social Security Disability Benefits",
    itemSummary:
      "Did you know that for many cancer survivors, the fight doesn't end when treatment does? Managing the Social Security disability benefits can be challenging. Often, these benefits are granted for just one year, even when debilitating side",
    itemContentText:
      "Did you know that for many cancer survivors, the fight doesn’t end when treatment does? Managing the Social Security disability benefits can be challenging. Often, these benefits are granted for just one year, even when debilitating side effects — like neuropathy, memory loss, and lymphedema — continue to impact daily life. Why lose out on the support you deserve? Simplify the complexities and see if you might qualify for ongoing benefits. Curious to learn more? Watch this",
    itemUrl:
      "https://www.thegoodlawgroup.com/blog/cancer-survivors-social-security-disability-benefits/",
    expected: ["Health & Medicine", "Politics & Policy"],
    needsReview: true,
    note: "Disability benefits for cancer survivors; health vs policy",
  },
  {
    id: "stored-cb976035",
    source: "stored",
    feedTitle: "Google | The Verge",
    feedDescription:
      "The Verge is about technology and how it makes us feel. Founded in 2011, we offer our audience everything from breaking news to reviews to award-winning features and investigations, on our site, in",
    feedUrl: "https://www.theverge.com/rss/google/index.xml",
    feedSiteUrl: "https://www.theverge.com/google",
    sourceKind: "rss",
    itemTitle: "Google dodges another breakup attempt",
    itemSummary:
      "US District Court Judge Leonie Brinkema declined the Justice Department's request to make Google sell off parts of its ad tech business, accepting milder remedies to restore competition to markets it illegally monopolized for years.",
    itemContentText:
      "US District Court Judge Leonie Brinkema declined the Justice Department's request to make Google sell off parts of its ad tech business, accepting milder remedies to restore competition to markets it illegally monopolized for years. Brinkema said she would adopt most of the behavioral changes proposed by the parties, with some modifications. But those won't become public until the parties meet to work out any additional proposed revisions and to review the judge's opinion",
    itemUrl: "https://www.theverge.com/policy/988316/google-ad-tech-antitrust-remedies-decision",
    expected: ["Politics & Policy", "Technology"],
  },
  {
    id: "stored-cbda4e3e",
    source: "stored",
    feedTitle: "Kubernetes Blog",
    feedDescription:
      "The Kubernetes blog is used by the project to communicate new features, community reports, and any news that might be relevant to the Kubernetes community.",
    feedUrl: "https://kubernetes.io/feed.xml",
    feedSiteUrl: "https://kubernetes.io/",
    sourceKind: "rss",
    itemTitle: "Kubernetes Changed Block Tracking API - Beta Differences",
    itemSummary:
      "Changed Block Tracking (CBT) support for CSI drivers shipped as Alpha in September 2025. With the March 2026 v1.0.0 release of the external-snapshot-metadata project, the feature moved to Beta . If you aren't yet familiar with changed",
    itemContentText:
      "Changed Block Tracking (CBT) support for CSI drivers shipped as Alpha in September 2025. With the March 2026 v1.0.0 release of the external-snapshot-metadata project, the feature moved to Beta . If you aren't yet familiar with changed block tracking for storage in Kubernetes, the Alpha announcement covers the motivation, the three primary components (the CSI SnapshotMetadata gRPC service, the SnapshotMetadataService CRD, and the external-snapshot-metadata sidecar), and a",
    itemUrl: "https://kubernetes.io/blog/2026/09/14/csi-changed-block-tracking-beta/",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-ccf9aa14",
    source: "stored",
    feedTitle: "Yorkshire Food Guide",
    feedDescription: "The best Yorkshire Restaurants, Street Food, Events & Offers",
    feedUrl: "https://yorkshirefoodguide.co.uk/feed",
    feedSiteUrl: "https://yorkshirefoodguide.co.uk/",
    sourceKind: "rss",
    itemTitle: "Relish North East and Yorkshire Cookbook Volume 3",
    itemSummary:
      "Per Book, Inc P&P The post Relish North East and Yorkshire Cookbook Volume 3 appeared first on Yorkshire Food Guide .",
    itemContentText:
      "Per Book, Inc P&P The post Relish North East and Yorkshire Cookbook Volume 3 appeared first on Yorkshire Food Guide .",
    itemUrl: "https://yorkshirefoodguide.co.uk/book/relish-north-east-yorkshire-cookbook/",
    expected: ["Food & Travel"],
    needsReview: true,
    note: "Cookbook product listing, thin text",
  },
  {
    id: "stored-cd115b73",
    source: "stored",
    feedTitle: "Sonodrum INT - Magazine",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.sonodrum.co/blogs/magazine.atom",
    feedSiteUrl: "https://www.sonodrum.co/blogs/magazine",
    sourceKind: "rss",
    itemTitle: "How to Choose the Right Steel Tongue Drum for Your Music Journey",
    itemSummary:
      "Choosing the right Steel Tongue Drum can be a game-changer in your musical journey. Whether you're a complete beginner or an experienced musician, this unique instrument offers a soothing sound that appeals to everyone. But with so many",
    itemContentText:
      "Choosing the right Steel Tongue Drum can be a game-changer in your musical journey. Whether you're a complete beginner or an experienced musician, this unique instrument offers a soothing sound that appeals to everyone. But with so many options available, it can be overwhelming to know which one is the best fit for you. In this guide, we’ll walk you through key considerations to help you select the perfect Steel Tongue Drum that aligns with your musical preferences and",
    itemUrl:
      "https://www.sonodrum.co/blogs/magazine/how-to-choose-the-right-steel-tongue-drum-for-your-music-journey",
    expected: ["Culture & Media"],
    needsReview: true,
    note: "Instrument buying guide; Culture vs none",
  },
  {
    id: "stored-ce144f34",
    source: "stored",
    feedTitle: "health and fitness blog",
    feedDescription:
      "A blog about healthyeating lifestyle fitness food healthyfood recipes healthproducts etc,health and fitness blog,health tips,[mental health blog],",
    feedUrl: "https://collectiveinfotech.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://collectiveinfotech.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "New Balance SuperComp Rebel Review | A Super Trainer That Feels Race Ready",
    itemSummary:
      "The New Balance SuperComp Rebel V1 is fun. I mean seriously fun, but maybe that’s because it’s not a Rebel at all. Naming conventions are becoming a problem with brands. Listen we know that you love the Rebel, we love the Rebel. But you",
    itemContentText:
      "The New Balance SuperComp Rebel V1 is fun. I mean seriously fun, but maybe that’s because it’s not a Rebel at all. Naming conventions are becoming a problem with brands. Listen we know that you love the Rebel, we love the Rebel. But you also have an entire SuperComp line up and now the two are meeting and it’s confusing. Nike going to verticals like 3 versions of the Vomero which are ALL meant to be cushioned shoes makes more sense. Having said that once you step in to the",
    itemUrl:
      "https://collectiveinfotech.blogspot.com/2026/09/new-balance-supercomp-rebel-review.html",
    expected: ["Sports"],
    needsReview: true,
    note: "Running shoe review; Sports vs product review",
  },
  {
    id: "stored-d0a4e605",
    source: "stored",
    feedTitle: "Cervical cancer : nature.com subject feeds",
    feedDescription: "Latest news and research from Nature.com on the topic of Cervical cancer",
    feedUrl: "https://www.nature.com/subjects/cervical-cancer.rss",
    feedSiteUrl: "https://www.nature.com/subjects/cervical-cancer",
    sourceKind: "rss",
    itemTitle:
      "Fruquintinib plus sintilimab in advanced cervical cancer: an open-label, multicentre, phase 2 study",
    itemSummary: null,
    itemContentText: null,
    itemUrl: "https://www.nature.com/articles/s43856-026-01572-z",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-d0bc89b7",
    source: "stored",
    feedTitle: "Abou Conde's Blog",
    feedDescription: "Cloud and Infra Security",
    feedUrl: "https://abouconde.com/feed",
    feedSiteUrl: "https://abouconde.com/",
    sourceKind: "rss",
    itemTitle:
      "🛡️ How to Ingest Syslog and CEF Logs into Microsoft Sentinel Using Azure Monitor Agent (AMA)",
    itemSummary:
      "Microsoft Sentinel enables security teams to collect, detect, investigate, and respond to security threats across hybrid and multi-cloud environments.A crucial part of this capability is log collection — especially from Linux systems and",
    itemContentText:
      "Microsoft Sentinel enables security teams to collect, detect, investigate, and respond to security threats across hybrid and multi-cloud environments. A crucial part of this capability is log collection — especially from Linux systems and network/security appliances that generate Syslog and CEF (Common Event Format) messages. With the Azure Monitor Agent (AMA) and Data Collection Rules (DCR) , Microsoft now provides a unified, modern way to onboard Syslog and CEF data into",
    itemUrl:
      "https://abouconde.com/2025/11/02/%f0%9f%9b%a1%ef%b8%8f-how-to-ingest-syslog-and-cef-logs-into-microsoft-sentinel-using-azure-monitor-agent-ama/",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-d12c8b24",
    source: "stored",
    feedTitle: "North Korea Tech – 노스코리아테크",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "http://www.northkoreatech.org/feed",
    feedSiteUrl: "https://www.northkoreatech.org/",
    sourceKind: "rss",
    itemTitle: "North Korea upgrades its Android security, says report",
    itemSummary:
      "A new report says smartphone users in North Korea were given until the end of 2023 to upgrade to a new version of the Android operating system or face confiscation of their phones. Source: North Korea Tech - 노스코리아테크 The post North Korea",
    itemContentText:
      "A new report says smartphone users in North Korea were given until the end of 2023 to upgrade to a new version of the Android operating system or face confiscation of their phones. Source: North Korea Tech - 노스코리아테크 The post North Korea upgrades its Android security, says report appeared first on North Korea Tech - 노스코리아테크 .",
    itemUrl:
      "https://www.northkoreatech.org/2024/01/06/north-korea-upgrades-its-android-security-says-report/",
    expected: ["Technology", "Security & Privacy"],
    needsReview: true,
    note: "NK phone OS mandate; Technology vs Security/surveillance",
  },
  {
    id: "stored-d1adbefe",
    source: "stored",
    feedTitle: "Little Homestead In Boise",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "http://littlehomesteadinboise.blogspot.com/feeds/posts/default",
    feedSiteUrl: "http://www.blogger.com/feeds/9040199365888949396/posts/default",
    sourceKind: "rss",
    itemTitle: "More Snow & The New Year, Recovery, My DNA Results!",
    itemSummary:
      "More Snow & The New Year- ***Update! We got over 5\" yesterday, a near record!*** If you followed this blog at all you know I love snow! Living in the high desert we don't always get very much, but it varies year to year. We had a couple of",
    itemContentText:
      "More Snow & The New Year- ***Update! We got over 5\" yesterday, a near record!*** If you followed this blog at all you know I love snow! Living in the high desert we don't always get very much, but it varies year to year. We had a couple of small snowfalls maybe an inch, but it melted. Then we got into some record high temp weather in December where it was almost 47°! Last week we finally had a good snow of 2 inches. Really beautiful! I had intentionally left a few holiday",
    itemUrl: "http://www.blogger.com/feeds/9040199365888949396/posts/default/2148005174408463752",
    expected: ["Personal & Essays"],
  },
  {
    id: "stored-d4febabe",
    source: "stored",
    feedTitle: "Santa Rosa Press Gazette",
    feedDescription: "If you don't get it, you don't get it.",
    feedUrl: "https://srpressgazette.com/feed",
    feedSiteUrl: "https://srpressgazette.com/",
    sourceKind: "rss",
    itemTitle: "City of Milton recognizes National Suicide Awareness Month",
    itemSummary:
      "Mayor Heather Lindsay proclaimed September as Suicide Awareness Month during a City Council meeting Sept. 8, presenting a proclamation to Pastor Bill Wright of Share Your Heart of Northwest Florida.",
    itemContentText:
      "Citing national data, the proclamation stated that suicide is the second-leading cause of death for people ages 10 to 34 and the 12th-leading cause of death in Florida. Veterans face a suicide rate 60 percent higher than the national average, and suicide is the leading cause of death among new mothers, with the highest risk nine to 12 months after birth. The proclamation also stated figures from 2021 that show fewer than half of adults with mental illness received the care",
    itemUrl:
      "https://srpressgazette.com/city-of-milton-recognizes-national-suicide-awareness-month/",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-d6c4fbe0",
    source: "stored",
    feedTitle: "Designer Spaces - Home Trends Magazine",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://canadianhometrends.com/category/designer-spaces/feed",
    feedSiteUrl: "https://canadianhometrends.com/category/designer-spaces/",
    sourceKind: "rss",
    itemTitle: "Transforming Julliette’s Place",
    itemSummary:
      "In May, the team at Imajen Design + Decor had the remarkable opportunity to partner with Juillette’s Place, a women’s shelter dedicated to providing safety and support for women and their children fleeing domestic violence. With a shared",
    itemContentText:
      "In May, the team at Imajen Design + Decor had the remarkable opportunity to partner with Juillette’s Place, a women’s shelter dedicated to providing safety and support for women and their children fleeing domestic violence. With a shared vision of creating a nurturing environment, the team embarked on a mission to transform a much-needed space within the shelter. The room in question was the wellness room, a sanctuary where women could find solace and engage in various",
    itemUrl: "https://canadianhometrends.com/transforming-julliettes-place/",
    expected: ["Design & UX"],
  },
  {
    id: "stored-d8129fc5",
    source: "stored",
    feedTitle: "www.postandcourier.com - RSS Results in sports/carolina of type article",
    feedDescription:
      "www.postandcourier.com - RSS Results in section(s) sports/carolina only for asset type(s) of article",
    feedUrl:
      "https://www.postandcourier.com/search?c=sports/carolina&f=rss&l=50&s=start_time&sd=desc&t=article",
    feedSiteUrl:
      "https://www.postandcourier.com/search/?c=sports/carolina&f=rss&l=50&s=start_time&sd=desc&t=article",
    sourceKind: "rss",
    itemTitle: "Swain doesn't let mistake haunt, scoring second touchdown after giving one up",
    itemSummary:
      "Vicari Swain set a school record, scored two touchdowns, got mixed up on a play that allowed a touchdown, blocked a PAT and celebrated his birthday on Saturday.",
    itemContentText:
      "Vicari Swain set a school record, scored two touchdowns, got mixed up on a play that allowed a touchdown, blocked a PAT and celebrated his birthday on Saturday.",
    itemUrl:
      "https://www.postandcourier.com/sports/carolina/gamecocks-vicari-swain-towson-punt-returns-touchdowns/article_2fac7616-abaf-48ca-a272-0d33cb3c7b4b.html",
    expected: ["Sports"],
  },
  {
    id: "stored-d9fc1795",
    source: "stored",
    feedTitle: "The Hermeneutic of Continuity",
    feedDescription:
      "Therefore every scribe who has been trained for the kingdom of heaven is like a householder who brings out of his treasure what is new and what is old.",
    feedUrl: "https://the-hermeneutic-of-continuity.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://the-hermeneutic-of-continuity.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "On the Attempted Cancellation of Father Zuhlsdorf",
    itemSummary:
      "Since the US election, Fr Zuhlsdorf has been subjected to a concerted attack from some liberal catholic publications. This would not be noteworthy except for the fact that as a result, he has been asked to move from the diocese where he",
    itemContentText:
      "Since the US election, Fr Zuhlsdorf has been subjected to a concerted attack from some liberal catholic publications. This would not be noteworthy except for the fact that as a result, he has been asked to move from the diocese where he currently works and has now to find accommodation. It is therefore reasonable to speak of an attempt to “cancel” him as the saying is nowadays. The Character of Fr Z’s Blog As an outspoken blogger, Fr Z is accustomed to opposition from",
    itemUrl:
      "https://the-hermeneutic-of-continuity.blogspot.com/2021/02/on-attempted-cancellation-of-father.html",
    expected: ["World & Society"],
  },
  {
    id: "stored-db0cdafb",
    source: "stored",
    feedTitle: "Combinatorial Game Theory",
    feedDescription: "My CGT musings, with an emphasis on the computational complexity of games.",
    feedUrl: "http://combinatorialgametheory.blogspot.com/feeds/posts/default",
    feedSiteUrl: "http://www.blogger.com/feeds/49096384337620230/posts/default",
    sourceKind: "rss",
    itemTitle: "International CGT in Japan, Day Four",
    itemSummary:
      'Yesterday, Sunday, was the last day of the first international CGT conference in Japan. Here are my summaries of the talks: Kentaro Hoshi: "Evolution of ANI (Artificial Narrow Intelligence) in Shogi and Social Adaptation: A case study for',
    itemContentText:
      'Yesterday, Sunday, was the last day of the first international CGT conference in Japan. Here are my summaries of the talks: Kentaro Hoshi: "Evolution of ANI (Artificial Narrow Intelligence) in Shogi and Social Adaptation: A case study for Symbiosis in the era of ASI (Artificial Super Intelligence)" Kentaro talked about Shogi and play has evolved in the past thirty years. Prior to the modern age, people had to move to Tokyo in order to be near other players and learn to play',
    itemUrl: "http://www.blogger.com/feeds/49096384337620230/posts/default/4567652408294965218",
    expected: ["Science & Research"],
    needsReview: true,
    note: "CGT conference talk summaries; math research vs games",
  },
  {
    id: "stored-dc27382d",
    source: "stored",
    feedTitle: "NBA Draft Room",
    feedDescription: "mock drafts",
    feedUrl: "https://nbadraftroom.com/feed",
    feedSiteUrl: "https://nbadraftroom.com/",
    sourceKind: "rss",
    itemTitle: "The Biggest Stock Risers From the 2026 FIBA U17 World Cup",
    itemSummary:
      "The FIBA U17 World Cup is one of the best early scouting events on the NBA draft calendar. It brings together many of the top prospects in an age group and gives us a first look at how their talent translates outside of high school or club",
    itemContentText:
      "The FIBA U17 World Cup is one of the best early scouting events on the NBA draft calendar. It brings together many of the top prospects in an age group and gives us a first look at how their talent translates outside of high school or club basketball. The 2026 tournament in Istanbul was especially interesting for the 2028 NBA Draft. Most of the leading players were born in 2009 and will first become draft eligible in 2028, making this a major international preview of that",
    itemUrl:
      "https://nbadraftroom.com/the-biggest-stock-risers-from-the-2026-fiba-u17-world-cup/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=the-biggest-stock-risers-from-the-2026-fiba-u17-world-cup",
    expected: ["Sports"],
  },
  {
    id: "stored-de455e5b",
    source: "stored",
    feedTitle: "Energy & Environment Story Archives - West Virginia Public Broadcasting",
    feedDescription: "Telling West Virginia's Story",
    feedUrl: "https://wvpublic.org/category/energy-environment/feed",
    feedSiteUrl: "https://wvpublic.org/category/energy-environment/",
    sourceKind: "rss",
    itemTitle: "Morrisey Promotes Energy Future To Gas And Oil Association",
    itemSummary:
      "Recent announcements from the governor’s office include a 2.6 gigawatt gas fired power plant in Grant County by Dominion Energy, a 500 megawatt plant in Moundsville, and a 1.2 gigawatt plant by Ft. Martin in Monongalia County. The post",
    itemContentText:
      "In a speech for the gas and oil association, Gov. Patrick Morrisey discussed more than $15 billion in economic development projects coming to the state. “When I came in, I knew that for West Virginia to lift its standard of living up, we needed to identify those needle-moving things to lower population loss, increase workforce participation, and draw private sector investment in at a level we've never seen before,” he said to the Gas and Oil Association of West Virginia",
    itemUrl:
      "https://wvpublic.org/story/energy-environment/morrisey-promotes-energy-future-to-gas-and-oil-association/",
    expected: ["Politics & Policy"],
  },
  {
    id: "stored-df238496",
    source: "stored",
    feedTitle: "VIAVI Perspectives",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://blog.viavisolutions.com/feed",
    feedSiteUrl: "https://blog.viavisolutions.com/",
    sourceKind: "rss",
    itemTitle: "Mission-Critical Communications at Mobile World Congress",
    itemSummary:
      "March sees the return of Mobile World Congress (MWC) Barcelona, and mission-critical communications is set to be a key theme at VIAVI’s booth 5B18. In every generation of mobile communications, VIAVI has been a trusted partner helping the",
    itemContentText:
      "March sees the return of Mobile World Congress (MWC) Barcelona, and mission-critical communications is set to be a key theme at VIAVI’s booth 5B18. In every generation of mobile communications, VIAVI has been a trusted partner helping the ecosystem prepare for and validate the path forward. As we approach the AI-driven evolution from 5G to […] The post Mission-Critical Communications at Mobile World Congress appeared first on VIAVI Perspectives .",
    itemUrl:
      "https://blog.viavisolutions.com/2026/01/28/mission-critical-communications-at-mobile-world-congress/",
    expected: ["Technology"],
  },
  {
    id: "stored-e10f51eb",
    source: "stored",
    feedTitle: "Glendale AZ Locksmith Blog - Glendale Locksmith 24 - Locksmith Articles",
    feedDescription: "Quick & Professional Locksmith Glendale AZ",
    feedUrl: "https://www.glendale-locksmith24.com/locksmith-articles/feed",
    feedSiteUrl: "https://www.glendale-locksmith24.com/locksmith-articles/",
    sourceKind: "rss",
    itemTitle: "High Security Locks",
    itemSummary:
      "High Security Locks and Lock Brands High-security locks provide increased protection against attacks. Common, inexpensive locks can easily be thwarted by experienced criminals with a minimal background in lock picking. If you use child",
    itemContentText:
      "High Security Locks and Lock Brands High-security locks provide increased protection against attacks. Common, inexpensive locks can easily be thwarted by experienced criminals with a minimal background in lock picking. If you use child seats in the car to protect your children, safes to protect your valuables, and insurance to protect your vehicle, why wouldn’t you invest in high security locks to keep your house protected against break-ins and theft? High-Security Lock",
    itemUrl: "https://www.glendale-locksmith24.com/high-security-locks/",
    expected: [],
    needsReview: true,
    note: "Locksmith physical locks article; not cybersecurity",
  },
  {
    id: "stored-e1571d8d",
    source: "stored",
    feedTitle: "The Window Blind Connection Inc.",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://thewindowblindconnection.com/feed",
    feedSiteUrl: "https://thewindowblindconnection.com/",
    sourceKind: "rss",
    itemTitle: "Environmental Impact Of Wood Blinds In Simi Valley California",
    itemSummary:
      "As someone who has lived and worked in Simi Valley for years, I often get asked about the environmental footprint of home products, especially window coverings. […]",
    itemContentText:
      "As someone who has lived and worked in Simi Valley for years, I often get asked about the environmental footprint of home products, especially window coverings. When residents ask about Wood Blinds, they want honest, practical answers about sustainability, durability, and how choices made in our Mediterranean climate affect local conservation efforts. In this article I’ll walk you through the real impacts, considerations for responsible purchases, and how to make choices",
    itemUrl:
      "https://thewindowblindconnection.com/wood-blinds/environmental-impact-of-wood-blinds-in-simi-valley-california/",
    expected: ["Climate & Environment"],
    needsReview: true,
    note: "Blinds vendor marketing framed as sustainability; could be none",
  },
  {
    id: "stored-e188d61b",
    source: "stored",
    feedTitle: "Roaming Hunger Blog » Food Trucks",
    feedDescription:
      "Serving more than 10 millions of mobile meals nationwide, Roaming Hunger helps you find and book your favorite food trucks for any event - big or small.",
    feedUrl: "https://roaminghunger.com/blog/category/food-trucks-2/feed",
    feedSiteUrl: "https://roaminghunger.com/blog/category/food-trucks-2",
    sourceKind: "rss",
    itemTitle: "Healthy Truck Eats: Specialty Diets, Food Allergies, and Sexy Abs",
    itemSummary:
      "Food trucks have come a long way since being misconstrued as the cousins of state fair food vendors and questionable taco joints. Most of us who keep up with the media and begrudgingly watch our waistlines have probably heard of the slew",
    itemContentText:
      "Food trucks have come a long way since being misconstrued as the cousins of state fair food vendors and questionable taco joints. Most of us who keep up with the media and begrudgingly watch our waistlines have probably heard of the slew of “lifestyle” diets that have become popular: Paleo, Primal, Gluten-free (celiac disease), Vegan, GAPS, […] The post Healthy Truck Eats: Specialty Diets, Food Allergies, and Sexy Abs first appeared on Roaming Hunger .",
    itemUrl:
      "https://roaminghunger.com/blog/6280/healthy-truck-eats-specialty-diets-food-allergies-sexy-abs",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-e26e55b5",
    source: "stored",
    feedTitle: "Software, web, and mobile development blog | Insane Lab",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://insanelab.com/blog/feed",
    feedSiteUrl: "http://insanelab.com/blog/",
    sourceKind: "rss",
    itemTitle: "LiveHelpNow mobile case study",
    itemSummary: "The post LiveHelpNow mobile case study appeared first on insanelab.com .",
    itemContentText:
      "June 10, 2019 - Mobile Development LiveHelpNow mobile case study 1. Introduction We as InsaneLab’s had incredible opportunity to help our partners – LiveHelpNow enhance their core business by developing brand new Android and iOS mobile applications to manage their customers business. LiveHelpNow! is a leading vendor of real-time live chat services, a service that can be included on your website which: gives you possibility to invite and start a chat with your customer – and",
    itemUrl: "https://insanelab.com/blog/mobile-development/livehelpnow-mobile-case-study/",
    expected: ["Software Engineering"],
  },
  {
    id: "stored-e3b327e6",
    source: "stored",
    feedTitle: "News Archives - Shih Tzu World",
    feedDescription: "Where Shih Tzus Are Family!",
    feedUrl: "https://shihtzuworld.com/category/news/feed",
    feedSiteUrl: "https://shihtzuworld.com/category/news/",
    sourceKind: "rss",
    itemTitle: "Oldest Shih Tzu",
    itemSummary:
      "Most dog breeds can be expected to live from 12 to 15 years on average. Depending on genetics, the living conditions, and the love that a shih tzu receives the average life span may be just as long as many other dog breeds. A typical shih",
    itemContentText:
      "Most dog breeds can be expected to live from 12 to 15 years on average. Depending on genetics, the living conditions, and the love that a shih tzu receives the average life span may be just as long as many other dog breeds. A typical shih tzu will live on average for 13 years. By the time the shih tzu reaches the age of 10, it is considered a senior citizen. This means biannual checks with the vet to help maintain their health. When shih tzus reach this advanced age, they",
    itemUrl: "https://shihtzuworld.com/oldest-shihtzu/",
    expected: [],
    needsReview: true,
    note: "Pet care article; no fitting label",
  },
  {
    id: "stored-e4550151",
    source: "stored",
    feedTitle: "FreshInbox",
    feedDescription: "Musings on Interactive Email techniques",
    feedUrl: "https://freshinbox.com/blog/feed",
    feedSiteUrl: "https://freshinbox.com/blog",
    sourceKind: "rss",
    itemTitle: "Gmail Starts Displaying Email Annotations Within the Main Promotions Tab List",
    itemSummary:
      "Gmail annotations was a big development that Google brought to promotional emails in the Promotions tab. Originally, only two annotated emails were displayed at the top of the Promotions tab. However, it is looking like Gmail is starting",
    itemContentText:
      "Two years ago Gmail launched email annotations for Promotions tab . This allows emails to feature a prominent image along with accompanying labels for offers beneath the subject line of the email in the Gmail App. At launch, Gmail only featured the annotated emails on the top two spots in a special “Top Deals” section in the Promotions tab. This meant only a few emails were displayed with these special features at a time. Annotations are appearing in the main list… randomly.",
    itemUrl:
      "https://freshinbox.com/blog/gmail-starts-displaying-email-annotations-within-the-main-promotions-tab-list/",
    expected: ["Technology"],
  },
  {
    id: "stored-e5d63f7f",
    source: "stored",
    feedTitle: "Sports – Sunday Punch",
    feedDescription: "Pangasinan's News Leader",
    feedUrl: "https://punch.dagupan.com/category/sports/feed",
    feedSiteUrl: "https://punch.dagupan.com/",
    sourceKind: "rss",
    itemTitle: "Dagupaña athlete bags bronze in SEAG 2025",
    itemSummary:
      "A woman athlete from Dagupan who donned the national uniform in the 33rd Southeast Asian Games, made his city mates proud when she bagged the bronze in the 1500m event in athletics on December 11. Susan Ramadan, a resident of Bonuan",
    itemContentText:
      "A woman athlete from Dagupan who donned the national uniform in the 33rd Southeast Asian Games, made his city mates proud when she bagged the bronze in the 1500m event in athletics on December 11. Susan Ramadan, a resident of Bonuan Gueset, was chosen to compete in the international stage and bagged the bronze medal in her event. Hailing Ramandan’s victory, Mayor Belen T. Fernandez, said, “ sa bawat hakbang ni Susan sa track, dala niya ang pangarap ng kanyang pamilya at ng",
    itemUrl: "https://punch.dagupan.com/sports/2025/12/dagupana-athlete-bags-bronze-in-seag-2025/",
    expected: ["Sports"],
  },
  {
    id: "stored-e6013010",
    source: "stored",
    feedTitle: "Access to Culture",
    feedDescription: "Sharon Schweitzer",
    feedUrl: "https://www.protocolww.com/feed",
    feedSiteUrl: "https://www.protocolww.com/",
    sourceKind: "rss",
    itemTitle: "Memorial Day",
    itemSummary:
      "Memorial Day Fireworks detonate above Mount Rushmore National Memorial, July 3. Approximately 30,000 people came to the memorial for the 2008 Independence Day Celebration. (U.S. Air Force photo/Senior Airman Marc I. Lane) As Memorial Day",
    itemContentText:
      "Memorial Day Fireworks detonate above Mount Rushmore National Memorial, July 3. Approximately 30,000 people came to the memorial for the 2008 Independence Day Celebration. (U.S. Air Force photo/Senior Airman Marc I. Lane) As Memorial Day approaches in the U.S., our readers inquire about its meaning and history. We created this fun quiz [...]",
    itemUrl: "https://www.protocolww.com/memorial-day-2/",
    expected: ["World & Society"],
    needsReview: true,
    note: "Memorial Day history quiz, thin; World vs Culture",
  },
  {
    id: "stored-e74645cd",
    source: "stored",
    feedTitle: "ITX",
    feedDescription: "Shared and Dedicated Web Hosting",
    feedUrl: "https://itxdesign.com/feed",
    feedSiteUrl: "https://itxdesign.com/",
    sourceKind: "rss",
    itemTitle: "How to Go From Hobby to Small Business",
    itemSummary:
      "Many believe that if you truly want to be happy with your work, you have to do what you love. Often, what we love becomes our hobbies, such as crafts, golf, food, dancing, etc. Part of the issue with trying to do what you love for an",
    itemContentText:
      "Many believe that if you truly want to be happy with your work, you have to do what you love. Often, what we love becomes our hobbies, such as crafts, golf, food, dancing, etc. Part of the issue with trying to do what you love for an income is you may have to start your own small business. It can be hard to find someone willing to pay you to do your hobby full time. However, blogging about it or turning your hobby into an online store is very possible. If you want to take",
    itemUrl:
      "https://itxdesign.com/how-to-go-from-hobby-to-small-business/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=how-to-go-from-hobby-to-small-business",
    expected: ["Business & Startups"],
  },
  {
    id: "stored-e74a1eab",
    source: "stored",
    feedTitle: "Travel Archives - A Boomer's Life After 50",
    feedDescription: "A Baby Boomer Woman's Life After 50",
    feedUrl: "https://www.aboomerslifeafter50.com/category/travel/feed",
    feedSiteUrl: "https://www.aboomerslifeafter50.com/category/travel/",
    sourceKind: "rss",
    itemTitle: "More Great Places to Eat in Sarasota During My 2026 Snowbird Stay",
    itemSummary:
      "As my 2026 snowbird stay in Florida winds down (OMG I’m leaving next week to go back to New Jersey), I wanted to share more great places to eat in Sarasota. To complement my “My 2025 Snowbird Search for Great... The post More Great Places",
    itemContentText:
      "As my 2026 snowbird stay in Florida winds down (OMG I’m leaving next week to go back to New Jersey) , I wanted to share more great places to eat in Sarasota. To complement my “My 2025 Snowbird Search for Great Places to Eat in Sarasota,” this season I’m bringing four more winners. I will note that my boyfriend E and I ate at several Sarasota restaurants the past four months but not all were blogworthy. Each one that follows celebrates a different type of cuisine and deserves",
    itemUrl:
      "https://www.aboomerslifeafter50.com/travel/more-great-places-to-eat-in-sarasota-during-my-2026-snowbird-stay/",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-e84462e5",
    source: "stored",
    feedTitle: "Climate News | TechCrunch",
    feedDescription: "Startup and Technology News",
    feedUrl: "https://techcrunch.com/category/climate/feed",
    feedSiteUrl: "https://techcrunch.com/category/climate/",
    sourceKind: "rss",
    itemTitle: "Google DeepMind alumni are building tools to accelerate fusion power for the grid",
    itemSummary:
      "Fusionality is developing control systems and simulation environments to help fusion power startups move faster.",
    itemContentText:
      "Fusionality is developing control systems and simulation environments to help fusion power startups move faster.",
    itemUrl:
      "https://techcrunch.com/2026/09/08/google-deepmind-alumni-are-building-tools-to-accelerate-fusion-power-for-the-grid/",
    expected: ["Climate & Environment", "Business & Startups"],
    needsReview: true,
    note: "Fusion startup story; climate vs business vs AI",
  },
  {
    id: "stored-e8695c47",
    source: "stored",
    feedTitle: "Untitled",
    feedDescription: "30A Florida Family Film Photographer - blog",
    feedUrl: "https://kayliebpoplin.com/feed",
    feedSiteUrl: "https://kayliebpoplin.com/",
    sourceKind: "rss",
    itemTitle: "Snow in Florida",
    itemSummary:
      "I cannot believe the words I am typing – but we had snow in Florida! We literally had snow at the beach! I am typing this from my desk with the windows open, watching the sunrise over the Choctawhatchee Bay right now all the while thinking",
    itemContentText:
      "I cannot believe the words I am typing – but we had snow in Florida! We literally had snow at the beach! I am typing this from my desk with the windows open, watching the sunrise over the Choctawhatchee Bay right now all the while thinking just a few weeks ago I saw inches of snow covering this same scene. I honestly believe you have not lived until you see a palm tree covered in snow. I will never forget the dropped jaws on everyone’s faces as we walked up and down our",
    itemUrl: "https://kayliebpoplin.com/snow-in-florida/",
    expected: ["Personal & Essays"],
  },
  {
    id: "stored-e8cb5e0b",
    source: "stored",
    feedTitle: "Astrophysics News -- ScienceDaily",
    feedDescription:
      "Astrophysics and space science. From microquasars to dark matter, read all the latest astrophysics news and research here. Full text with images, updated daily, free.",
    feedUrl: "https://www.sciencedaily.com/rss/space_time/astrophysics.xml",
    feedSiteUrl: "https://www.sciencedaily.com/news/space_time/astrophysics/",
    sourceKind: "rss",
    itemTitle: "Scientists turn Starlink into a giant scanner for Earth’s upper atmosphere",
    itemSummary:
      "Researchers have found a clever new way to map a part of Earth’s upper atmosphere that is notoriously difficult to observe. Using orbital data from roughly 1,200 Starlink satellites, they reconstructed changes in atmospheric density about",
    itemContentText:
      "Researchers have found a clever new way to map a part of Earth’s upper atmosphere that is notoriously difficult to observe. Using orbital data from roughly 1,200 Starlink satellites, they reconstructed changes in atmospheric density about 500 kilometers above Earth. The approach could sharpen satellite tracking and help reduce the growing risk of collisions in increasingly crowded orbits.",
    itemUrl: "https://www.sciencedaily.com/releases/2026/08/260812015212.htm",
    expected: ["Science & Research"],
  },
  {
    id: "stored-eb46878c",
    source: "stored",
    feedTitle: "The Vitality Method Blog",
    feedDescription:
      "Discover new and important articles on all things health and fitness. I cover topics including self-care and recipes. Vitality Method is a place for community - where you get strong, & radiantly",
    feedUrl: "https://pilates-athome.co.uk/feed",
    feedSiteUrl: "https://pilates-athome.co.uk/blog/",
    sourceKind: "rss",
    itemTitle: "September Energy Reset: It’s Not Just for the Kids",
    itemSummary:
      "September Energy Reset: It’s Not Just for the Kids Is anyone else getting that “back to school, back to routine” feeling? New term. New notebooks. New routines. And after the lovely looseness of summer, September always feels like a",
    itemContentText:
      "September Energy Reset: It’s Not Just for the Kids Is anyone else getting that “back to school, back to routine” feeling? New term. New notebooks. New routines. And after the lovely looseness of summer, September always feels like a natural opportunity to get yourself back into a rhythm too. But if your first thought is […] Source",
    itemUrl: "https://pilateshuddersfield.co.uk/energy_reset/",
    expected: ["Health & Medicine"],
    needsReview: true,
    note: "Wellness blog; health vs personal essay",
  },
  {
    id: "stored-eccbc9f3",
    source: "stored",
    feedTitle: "MyFitnessChat",
    feedDescription: "A blog on everything health and wellbeing.",
    feedUrl: "https://www.myfitnesschat.com/feed",
    feedSiteUrl: "https://www.myfitnesschat.com/",
    sourceKind: "rss",
    itemTitle:
      "Mental Health Awareness Week 2025: How Exercise Builds Community and Boosts Wellbeing",
    itemSummary:
      "This year, Mental Health Awareness Week (12–18 May 2025) shines a spotlight on the powerful […] The post Mental Health Awareness Week 2025: How Exercise Builds Community and Boosts Wellbeing appeared first on MyFitnessChat .",
    itemContentText:
      "This year, Mental Health Awareness Week ( 12–18 May 2025 ) shines a spotlight on the powerful theme of community . This is a great reminder of the importance of human connection in supporting our mental wellbeing. Beyond the physical benefits, exercise plays a vital role in creating a sense of belonging , motivation , and confidence . It’s more than just working out, it’s about being part of something bigger. Here are some ways exercise creates community and boosts mental",
    itemUrl:
      "https://www.myfitnesschat.com/mental-health-awareness-week-2025-how-exercise-builds-community-and-boosts-wellbeing/",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-f067a70d",
    source: "stored",
    feedTitle: "Lee Wolfe Pottery - Studio News",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.leewolfepottery.com/blogs/news.atom",
    feedSiteUrl: "https://www.leewolfepottery.com/blogs/news",
    sourceKind: "rss",
    itemTitle: "The Mushroom Ball Collection",
    itemSummary:
      "Handmade bowls, woodland mugs, and a celebration of connection—this ceramic collection is especially close to my heart. More",
    itemContentText:
      "Somewhere between dusk and dream, the mushrooms gathered. The forest felt… off. The birds were forgetting their songs, and the soil didn’t hum the way it used to. Something was missing. They decided it was time for a ball. Not just any gathering, but a true celebration—a dance to lift the spirits of the woods. But a ball like this would require very specific decor: platters adorned with mushrooms, bowls shaped by hand and moonlight, and—most importantly—brand new mugs.",
    itemUrl: "https://www.leewolfepottery.com/blogs/news/the-mushroom-ball-collection",
    expected: [],
    needsReview: true,
    note: "Pottery collection listing; none vs Culture & Media",
  },
  {
    id: "stored-f1526c38",
    source: "stored",
    feedTitle: "Canlas Law Group",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.canlaslaw.com/feed",
    feedSiteUrl: "https://www.canlaslaw.com/",
    sourceKind: "rss",
    itemTitle:
      "Healthcare Worker Injuries at Orange County Hospitals: Work Comp for Nurses and Medical Staff",
    itemSummary:
      "Healthcare professionals work demanding jobs that can routinely leave them vulnerable to significant risks. Workplace injuries are a widespread reality across the industry and nation, so it’s possible for medical staff to get hurt at work",
    itemContentText:
      "Healthcare professionals work demanding jobs that can routinely leave them vulnerable to significant risks. Workplace injuries are a widespread reality across the industry and nation, so it’s possible for medical staff to get hurt at work in California. If you sustain healthcare worker injuries at Orange County hospitals , for example, workers’ compensation for nurses and medical staff should be available. If you need to file for benefits, turn to a workplace injury lawyer",
    itemUrl:
      "https://www.canlaslaw.com/blog/healthcare-worker-injuries-at-orange-county-hospitals-work-comp-for-nurses-and-medical-staff/",
    expected: ["Education & Work"],
    needsReview: true,
    note: "Workers comp for healthcare staff; work vs health vs law",
  },
  {
    id: "stored-f1a73236",
    source: "stored",
    feedTitle: "manchesterroofersltd.co.uk",
    feedDescription: "Manchester Roofers LTD",
    feedUrl: "https://manchesterroofersltd.co.uk/feed",
    feedSiteUrl: "https://manchesterroofersltd.co.uk/",
    sourceKind: "rss",
    itemTitle: "Flat Roof Leaks In Heavy Rain (Pro Tips And Fixes)",
    itemSummary:
      "Our roof shields us from the elements, including rain, sun, snow, and wind. Roofs can be flat, sloped, vaulted, domed, or various other shapes, depending on your house design. You…",
    itemContentText:
      "Our roof shields us from the elements, including rain, sun, snow, and wind. Roofs can be flat, sloped, vaulted, domed, or various other shapes, depending on your house design. You can expect a new roof to last up to 25 years. However, after around 15 years, you may notice condensation on your ceiling or even dripping water from your roof. This may be caused by inadequate drainage systems, which is a cause for concern during heavy rainfall. Repairing a leaking flat roof can",
    itemUrl: "https://manchesterroofersltd.co.uk/flat-roof-leaks-in-heavy-rain/",
    expected: [],
  },
  {
    id: "stored-f21a47c4",
    source: "stored",
    feedTitle: "Titan Web Agency Blog",
    feedDescription:
      "Struggling to attract new patients? Our dental marketing blog provides proven solutions for your biggest challenges—from boosting SEO rankings to increasing patient bookings.",
    feedUrl: "https://blog.titanwebagency.com/rss.xml",
    feedSiteUrl: "https://blog.titanwebagency.com/",
    sourceKind: "rss",
    itemTitle: "Why Your Dental Practice Appears in Local Search Results but Not in AI Answers",
    itemSummary:
      "When patients search for a dentist today, the process often begins with a question. As AI search becomes part of everyday browsing, patients increasingly begin by asking a question and reviewing the AI-generated answer, such as from",
    itemContentText:
      "When patients search for a dentist today, the process often begins with a question. As AI search becomes part of everyday browsing, patients increasingly begin by asking a question and reviewing the AI-generated answer, such as from ChatGPT or Google AI Overviews.",
    itemUrl: "https://blog.titanwebagency.com/google-maps-vs-ai-search",
    expected: ["Business & Startups", "AI & ML"],
    needsReview: true,
    note: "Dental marketing for AI search; Business vs AI",
  },
  {
    id: "stored-f2628676",
    source: "stored",
    feedTitle: "Yahoo Actualités - Toute l'actualité en France et dans le monde",
    feedDescription:
      "Suivez l’actualité en France et dans le monde sur Yahoo Actualités. Consultez et recherchez dans la source d’information la plus complète du web",
    feedUrl: "https://fr.news.yahoo.com/rss",
    feedSiteUrl: "https://fr.news.yahoo.com/",
    sourceKind: "rss",
    itemTitle:
      'Elections en Suède: les sociaux-démocrates "prêts" à gouverner malgré des résultats très serrés',
    itemSummary: null,
    itemContentText:
      "La cheffe des sociaux-démocrates en Suède s'est dite \"prête\" à gouverner le pays, à l'issue des élections législatives du dimanche qui n'ont pas donné de clair vainqueur, laissant présager de longues et difficiles tractations entre partis. Le pays nordique vit une nuit électorale pleine de rebondissements -- comme il en a l'habitude. Il y a d'abord eu les rugissements des sociaux démocrates, lors de la publication des premiers sondages de sorties des urnes. Les médias",
    itemUrl:
      "https://fr.news.yahoo.com/gauche-ministres-dextr%C3%AAme-droite-scrutin-232036076.html",
    expected: ["Politics & Policy"],
  },
  {
    id: "stored-f2c49fd8",
    source: "stored",
    feedTitle: "JANGBRiCKS LEGO reviews & MOCs",
    feedDescription:
      "LEGO set reviews, huge city layout with custom MOCs & more! Covering Star Wars, Creator, Marvel & DC super heroes, Ideas, anything with trains, and many other themes.",
    feedUrl: "https://www.jangbricks.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://www.jangbricks.com/",
    sourceKind: "rss",
    itemTitle: "Recovery update",
    itemSummary:
      'For a little more than a month now I\'ve been back to work on a "new normal" basis, getting caught up on reviews and figuring out how to most comfortably & efficiently work in the all-new studio. Viewer reaction to the new format has been',
    itemContentText:
      'For a little more than a month now I\'ve been back to work on a "new normal" basis, getting caught up on reviews and figuring out how to most comfortably & efficiently work in the all-new studio. Viewer reaction to the new format has been shockingly positive . I, myself, have felt perfectly comfortable being in front of the camera again, though I do yet need to work on physical access to review subjects from behind the filming rig when doing the traditional close-up shots.',
    itemUrl: "https://www.jangbricks.com/2020/03/recovery-update.html",
    expected: ["Personal & Essays"],
    needsReview: true,
    note: "LEGO YouTuber personal update; maybe Culture & Media",
  },
  {
    id: "stored-f5330328",
    source: "stored",
    feedTitle: "Dezeen",
    feedDescription: "architecture and design magazine",
    feedUrl: "https://www.dezeen.com/feed",
    feedSiteUrl: "https://www.dezeen.com/",
    sourceKind: "rss",
    itemTitle: "Jonathan Anderson and Anab Jain among winners of London Design Medal",
    itemSummary:
      "JW Anderson founder Jonathan Anderson has won this year's London Design Medal for his work \"blending high fashion, art and craft\". While Anderson won the London Design Medal, the award scheme's highest accolade, Superflux co-founder Anab",
    itemContentText:
      "JW Anderson founder Jonathan Anderson has won this year's London Design Medal for his work \"blending high fashion, art and craft\". While Anderson won the London Design Medal, the award scheme's highest accolade, Superflux co-founder Anab Jain was named winner of the Design Innovation Medal. This year's Emerging Talent Medal was won by Mimica founder Solveiga Pakštaitė, while the Lifetime Achievement Medal awarded to academic Christopher Frayling. The four design medals are",
    itemUrl: "https://www.dezeen.com/2026/09/10/london-design-medal-2026-jonathan-anderson/",
    expected: ["Design & UX"],
  },
  {
    id: "stored-f5b2b450",
    source: "stored",
    feedTitle: "ADHD Treatment Category Archives | New Directions Mental Health",
    feedDescription: "Pennsylvania Mental Health Counseling",
    feedUrl: "https://newdirectionspgh.com/counseling-blog/category/adhd-treatment/feed",
    feedSiteUrl: "https://newdirectionspgh.com/counseling-blog/category/adhd-treatment/feed/",
    sourceKind: "rss",
    itemTitle: "Benefits of Adult ADHD Treatment in Canonsburg",
    itemSummary:
      "During the COVID-19 pandemic, prescriptions for ADHD treatments surged among adults.1 These adults struggled to manage their symptoms while working from home and facing additional… The post Benefits of Adult ADHD Treatment in Canonsburg",
    itemContentText:
      "During the COVID-19 pandemic, prescriptions for ADHD treatments surged among adults. 1 These adults struggled to manage their symptoms while working from home and facing additional stressors. This highlights the need for effective adult ADHD treatment options in Canonsburg, PA, and other areas. While medication is often the first line of treatment for ADHD , it may not be the best option for everyone. That’s why adults need access to various treatment options that address",
    itemUrl:
      "https://newdirectionspgh.com/counseling-blog/benefits-of-adult-adhd-treatment-in-canonsburg/",
    expected: ["Health & Medicine"],
  },
  {
    id: "stored-f6de3231",
    source: "stored",
    feedTitle: "Ad Orientem",
    feedDescription:
      "is the blog of an Orthodox Christian and is published under the spiritual patronage of St. John of San Francisco. Topics likely to be discussed include matters relating to Orthodoxy as well as other",
    feedUrl: "http://ad-orientem.blogspot.com/feeds/posts/default",
    feedSiteUrl: "http://www.blogger.com/feeds/25740524/posts/default",
    sourceKind: "rss",
    itemTitle: "Our ancestors were made of iron",
    itemSummary: "HT: Fr. Z Syndicated by Atom",
    itemContentText: "HT: Fr. Z Syndicated by Atom",
    itemUrl: "http://www.blogger.com/feeds/25740524/posts/default/917577632034762377",
    expected: [],
    needsReview: true,
    note: "Empty text; religious blog repost",
  },
  {
    id: "stored-f76524c0",
    source: "stored",
    feedTitle: "Chai Chun - post",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.chaichuntea.com/blogs/post.atom",
    feedSiteUrl: "https://www.chaichuntea.com/blogs/post",
    sourceKind: "rss",
    itemTitle: "Diwali Gifting Sorted: Elegant Tea Collections to Impress Everyone",
    itemSummary:
      "This Diwali, don’t settle for predictable gifting. Instead, embrace the elegance of tea—a gift that carries tradition, health, and joy in every sip. With Chai Chun’s premium gift boxes, you’re not just giving tea; you’re gifting moments of",
    itemContentText:
      "Diwali is that magical time of year when homes sparkle with diyas, the fragrance of marigold fills the air, and every corner hums with festive excitement. Families come together to clean, decorate, and cook; children wait eagerly for crackers, while elders prepare thalis of sweets and namkeens to welcome guests. Amidst the laughter, the rituals, and the joy of togetherness, there is one constant— a cup of tea shared with loved ones . In many households, tea is more than a",
    itemUrl:
      "https://www.chaichuntea.com/blogs/post/diwali-gifting-sorted-elegant-tea-collections-to-impress-everyone",
    expected: ["Food & Travel"],
    needsReview: true,
    note: "Promotional tea gifting post; Food vs none",
  },
  {
    id: "stored-f77cb334",
    source: "stored",
    feedTitle: "Friars on Base Feed",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://friarsonbase.com/feed",
    feedSiteUrl: "https://friarsonbase.com/",
    sourceKind: "rss",
    itemTitle: "Padres sign quirky former Dodgers World Series champion in unexpected reunion",
    itemSummary:
      "A.J. Preller added another late-season lottery ticket as Brent Honeywell Jr. returned to the Padres on a low-risk minor league deal.",
    itemContentText:
      "A.J. Preller added another late-season lottery ticket as Brent Honeywell Jr. returned to the Padres on a low-risk minor league deal.",
    itemUrl:
      "https://friarsonbase.com/padres-sign-quirky-former-dodgers-reliever-in-unexpected-reunion?utm_source=RSS",
    expected: ["Sports"],
  },
  {
    id: "stored-f7ea4ab2",
    source: "stored",
    feedTitle: "Teacher Tom",
    feedDescription: "Teaching and learning from preschoolers",
    feedUrl: "https://feeds.feedburner.com/TeacherTom",
    feedSiteUrl: "http://www.blogger.com/feeds/15932919/posts/default?redirect=false",
    sourceKind: "rss",
    itemTitle: "Nasty, Uncontrollable, Hopelessly Feral",
    itemSummary:
      "\"I really can't stand children.\" It's a sentiment I occasionally encounter upon informing a stranger of the work I do. It always rocks me back on my heels a bit, given that I'm most often surrounded by adults who find the company of young",
    itemContentText:
      "\"I really can't stand children.\" It's a sentiment I occasionally encounter upon informing a stranger of the work I do. It always rocks me back on my heels a bit, given that I'm most often surrounded by adults who find the company of young children to be preferable to that of their peers. All adults have theories about children, even those who spend little time with them. After all, we were all once children, so, at a minimum we have those years of experience from which to",
    itemUrl: "http://www.blogger.com/feeds/15932919/posts/default/1378076660170311835",
    expected: ["Education & Work", "Personal & Essays"],
  },
  {
    id: "stored-f8712b1e",
    source: "stored",
    feedTitle: "Asia's Developing Future",
    feedDescription:
      "ADBI is the think tank of the Asian Development Bank. We conduct policy research and capacity building to drive sustainable development in Asia and the Pacific.",
    feedUrl: "https://feeds.soundcloud.com/users/soundcloud:users:287130128/sounds.rss",
    feedSiteUrl: "http://www.adbi.org/",
    sourceKind: "rss",
    itemTitle: "Asia needs better financial monitoring and safeguards as integration increases",
    itemSummary:
      "Asian economies and financial systems are becoming ever more integrated, but their monitoring has not kept pace and better safeguards are needed. This is especially true for cross-border issues. Peter Morgan, co-chair of research at the",
    itemContentText:
      "Asian economies and financial systems are becoming ever more integrated, but their monitoring has not kept pace and better safeguards are needed. This is especially true for cross-border issues. Peter Morgan, co-chair of research at the Asian Development Bank Institute, says that Europe can provide a valuable guide to developing the necessary institutions in Asia. Read the transcript https://bit.ly/2Mi3WII Read the book",
    itemUrl:
      "https://soundcloud.com/adbinstitute/asia-needs-better-financial-monitoring-safeguards-integration-increases",
    expected: ["Finance & Markets"],
  },
  {
    id: "stored-fa77ad51",
    source: "stored",
    feedTitle: "Junebug Jewelry Designs Blog",
    feedDescription:
      "Step into Junebug Jewelry Designs studio to witness the creative process and inspirations firsthand. Discover the artistry behind each unique piece and gain valuable jewellery insights. Serving Ohio",
    feedUrl: "https://junebugjewelrydesigns.com/blogs/inside-the-studio-1.atom",
    feedSiteUrl: "https://junebugjewelrydesigns.com/blogs/inside-the-studio-1",
    sourceKind: "rss",
    itemTitle: "Celebrate April Birthdays with Opal",
    itemSummary:
      "Celebrate April Birthdays with Opal Gemstones Happy birthday to all you Aries out there. This month, Junebug focuses on Opal gemstones, an alternative to the diamond birthstones for April. This iridescent stone has natural simmering",
    itemContentText:
      "Celebrate April Birthdays with Opal Gemstones Happy birthday to all you Aries out there. This month, Junebug focuses on Opal gemstones, an alternative to the diamond birthstones for April. This iridescent stone has natural simmering yellows, greens, blues, reds and purples as the light dances across the surface. Hindu, Greek and Roman cultures believed opals gave those who possessed them the power of foresight. But anyone can see the beauty within these semi-precious stones.",
    itemUrl:
      "https://junebugjewelrydesigns.com/blogs/inside-the-studio-1/celebrate-april-birthdays-with-opal",
    expected: [],
  },
  {
    id: "stored-fa7ad879",
    source: "stored",
    feedTitle: "The Woolly Adventures of a Knitting Kitty",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://theknittingexploitsofjosiekitten.blogspot.com/feeds/posts/default?alt=rss",
    feedSiteUrl: "https://theknittingexploitsofjosiekitten.blogspot.com/",
    sourceKind: "rss",
    itemTitle: "Blogmas Day 17",
    itemSummary:
      "🎄🎄🎄 Day 17 🎄🎄🎄 If you are looking for a Christmas present for someone creative, I can definitely recommend getting either a gift voucher from the Craft Courses website or booking them an actual class. I have done a few since I discovered",
    itemContentText:
      "🎄🎄🎄 Day 17 🎄🎄🎄 If you are looking for a Christmas present for someone creative, I can definitely recommend getting either a gift voucher from the Craft Courses website or booking them an actual class. I have done a few since I discovered their website back in 2019 and have thoroughly enjoyed all of them. All but one I have given as a gift and gone along with the recipient so I have got to enjoy the experience too! You can search by craft and also by area so it's possible to",
    itemUrl: "https://theknittingexploitsofjosiekitten.blogspot.com/2022/12/blogmas-day-17.html",
    expected: [],
  },
  {
    id: "stored-fafe30ae",
    source: "stored",
    feedTitle: "Food Turkey",
    feedDescription: "Turkish Food Magazine",
    feedUrl: "https://www.foodturkey.com.tr/en/feed",
    feedSiteUrl: "https://www.foodturkey.com.tr/en/",
    sourceKind: "rss",
    itemTitle:
      "IFPA launches 2026 EU policy agenda to boost fruit and vegetable consumption and strengthen Europe’s fresh produce and floral sectors",
    itemSummary:
      "The International Fresh Produce Association (IFPA) has launched its new EU policy agenda aimed at increasing fruit and vegetable consumption across Europe while strengthening trade and sustainability across the fresh produce and floral",
    itemContentText:
      "The International Fresh Produce Association (IFPA) has launched its new EU policy agenda aimed at increasing fruit and vegetable consumption across Europe while strengthening trade and sustainability across the fresh produce and floral sectors. To achieve this, IFPA sets out three pillars focused on improving accessibility and strengthening consumer awareness. The first pillar, nutrition and health, centres on boosting the consumption of fresh produce to combat the risks of",
    itemUrl:
      "https://www.foodturkey.com.tr/2026/04/13/ifpa-launches-2026-eu-policy-agenda-to-boost-fruit-and-vegetable-consumption-and-strengthen-europes-fresh-produce-and-floral-sectors/",
    expected: ["Food & Travel", "Politics & Policy"],
    needsReview: true,
    note: "Produce industry EU policy agenda; Food vs Politics",
  },
  {
    id: "stored-fb9ea963",
    source: "stored",
    feedTitle: "Jia Shin Lee",
    feedDescription: "Malaysian Lifestyle and Mummy Blogger",
    feedUrl: "https://www.jiashinlee.com/feeds/posts/default",
    feedSiteUrl: "https://www.blogger.com/feeds/2605901670473996820/posts/default",
    sourceKind: "rss",
    itemTitle: "Singaporean Beauty and Wellness Brand Omno Makes Its Official Debut in Malaysia",
    itemSummary:
      "Omno, the Singaporean wellness and beauty brand, has arrived in Malaysia with a grand launch event at Else Hotel, Kuala Lumpur. With Omno's range of eco-conscious products helps elevate your self-care routine that embraces a lifestyle that",
    itemContentText:
      "Omno, the Singaporean wellness and beauty brand, has arrived in Malaysia with a grand launch event at Else Hotel, Kuala Lumpur. With Omno's range of eco-conscious products helps elevate your self-care routine that embraces a lifestyle that celebrates the perfect balance between beauty and sustainability. Introducing Omno's signature scents: Solace, Moonatic, and Odyssey. Each fragrance is meticulously curated to capture the essence of our Southeast Asian heritage with a",
    itemUrl: "https://www.blogger.com/feeds/2605901670473996820/posts/default/7544049038960692664",
    expected: [],
    needsReview: true,
    note: "Beauty brand launch; none vs Business & Startups",
  },
  {
    id: "stored-fbfbeb7b",
    source: "stored",
    feedTitle: "Healthcare IT Leaders",
    feedDescription: "Follow recent articles from this feed",
    feedUrl: "https://www.healthcareitleaders.com/feed",
    feedSiteUrl: "https://www.healthcareitleaders.com/",
    sourceKind: "rss",
    itemTitle: "What Is Cerner HealtheIntent? Oracle Health Data Intelligence Explained",
    itemSummary:
      "Cerner HealtheIntent was the name of a cloud-based population health and data platform. Current Oracle materials use Oracle Health Data Intelligence. The older HealtheIntent name remains familiar to many healthcare teams. The platform",
    itemContentText:
      "Cerner HealtheIntent was the name of a cloud-based population health and data platform. Current Oracle materials use Oracle Health Data Intelligence. The older HealtheIntent name remains familiar to many healthcare teams. The platform brings together clinical, claims, pharmacy, social, and other data. Teams can use that information to create longitudinal records and support analytics. It can also inform population health and value-based care workflows. Is HealtheIntent Now",
    itemUrl: "https://www.healthcareitleaders.com/blog/what-is-cerner-healtheintent/",
    expected: ["Technology", "Health & Medicine"],
  },
  {
    id: "stored-fcb059c4",
    source: "stored",
    feedTitle: "GCA Mortgage Forums",
    feedDescription: "Powered by Gustan Cho Associates",
    feedUrl: "https://gcaforums.com/feed",
    feedSiteUrl: "https://gcaforums.com/",
    sourceKind: "rss",
    itemTitle: "Guide To Moving and Buying a House in Alaska",
    itemSummary:
      "This guide covers moving and buying a house in Alaska. The decision to move your family to Alaska, like any significant life decision, is subjective…",
    itemContentText:
      "This guide covers moving and buying a house in Alaska. The decision to move your family to Alaska, like any significant life decision, is subjective and depends on various factors. Moving and buying a house in Alaska is a big move. Moving to Alaska can be quite a lifestyle shift, especially if you’re from a more urban or temperate location. John Strange, a senior loan officer at GCA Mortgage Forums Mortgage Group says the following about moving and buying a house in Alaska:",
    itemUrl: "https://gcaforums.com/buying-a-house-in-alaska/",
    expected: ["Finance & Markets"],
    needsReview: true,
    note: "Relocation/home-buying guide; Finance vs Travel",
  },
  {
    id: "stored-fd750934",
    source: "stored",
    feedTitle: "Opinions | The Hindu",
    feedDescription:
      "The Hindu’s opinion section featuring a wide range of articles, editorials, and analysis covering various topics such as current affairs, politics, social issues, and more.",
    feedUrl: "https://www.thehindu.com/opinion/feeder/default.rss",
    feedSiteUrl: "https://www.thehindu.com/opinion/",
    sourceKind: "rss",
    itemTitle: "When life strips away titles",
    itemSummary: "What will remain are personal qualities: character, skills, attitudes",
    itemContentText: "What will remain are personal qualities: character, skills, attitudes",
    itemUrl:
      "https://www.thehindu.com/opinion/op-ed/when-life-strips-away-titles/article71438864.ece",
    expected: ["Personal & Essays"],
    needsReview: true,
    note: "Thin opinion text; personal reflection assumed",
  },
  {
    id: "stored-fe0d9f51",
    source: "stored",
    feedTitle: "Untitled",
    feedDescription: "Park City Utah, Destination Wedding Photographer",
    feedUrl: "https://meganrobinsonphoto.com/feed",
    feedSiteUrl: "https://meganrobinsonphoto.com/",
    sourceKind: "rss",
    itemTitle: "Modern Garden Party Wedding at Montage Deer Valley | Katelyn + Andy",
    itemSummary:
      "Looking for a wedding design aesthetic that will truly never go out of style? Cue the garden party wedding theme. For their summer mountain wedding, Katelyn and Andy gave this theme a modern update while embracing its timeless style. The",
    itemContentText:
      "Looking for a wedding design aesthetic that will truly never go out of style? Cue the garden party wedding theme. For their summer mountain wedding, Katelyn and Andy gave this theme a modern update while embracing its timeless style. The pastel color palette, opulent lush florals, and romantic mountain setting made it feel like you were stepping into a dream. But what I love about this trend is how versatile it is. Neutral or pops of color, vintage or modern aesthetic,",
    itemUrl:
      "https://meganrobinsonphoto.com/modern-garden-party-wedding-at-montage-deer-valley/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=modern-garden-party-wedding-at-montage-deer-valley",
    expected: [],
    needsReview: true,
    note: "Wedding design feature; none vs Design & UX",
  },
  {
    id: "stored-fe665b7e",
    source: "stored",
    feedTitle: "Strobes Security Blog",
    feedDescription:
      "Insights on cybersecurity, vulnerability management, CTEM, and exposure management from the Strobes Security team.",
    feedUrl: "https://strobes.co/feed.xml",
    feedSiteUrl: "https://strobes.co/blog",
    sourceKind: "rss",
    itemTitle: "Are security practitioners actually ready for autonomous pentesting?",
    itemSummary:
      "We asked 50+ security leaders one open question about autonomous pentesting. Here is the readiness spectrum that came back, and what vendors get wrong.",
    itemContentText:
      "We asked 50+ security leaders one open question about autonomous pentesting. Here is the readiness spectrum that came back, and what vendors get wrong.",
    itemUrl: "https://strobes.co/blog/are-security-practitioners-ready-for-autonomous-pentesting",
    expected: ["Security & Privacy"],
  },
  {
    id: "stored-fea4194d",
    source: "stored",
    feedTitle: "Miami Beach Weekly",
    feedDescription:
      "Miami Beach Weekly offers an insider’s view into the vibrant pulse of Miami Beach, featuring the latest in news, culture, fashion, and entertainment from one of the world’s most iconic coastal cities.",
    feedUrl: "https://www.miamibeachweekly.com/feeds/posts/default",
    feedSiteUrl: "https://www.blogger.com/feeds/4922595134620789315/posts/default",
    sourceKind: "rss",
    itemTitle: "Miami Beach's Boutique Wellness Hotels Are Redefining the Art of Luxury Travelv",
    itemSummary:
      "Luxury travel is evolving, and nowhere is that transformation more evident than in Miami Beach's growing collection of boutique wellness hotels. Rather than focusing solely on lavish accommodations, these intimate properties are creating",
    itemContentText:
      "Luxury travel is evolving, and nowhere is that transformation more evident than in Miami Beach's growing collection of boutique wellness hotels. Rather than focusing solely on lavish accommodations, these intimate properties are creating immersive experiences centered on relaxation, personalized service, holistic well-being, and sophisticated design. From sunrise yoga overlooking the Atlantic Ocean to award-winning spa treatments and chef-curated wellness menus, the city's",
    itemUrl: "https://www.blogger.com/feeds/4922595134620789315/posts/default/3650712737364726504",
    expected: ["Food & Travel"],
  },
  {
    id: "stored-ffc93e40",
    source: "stored",
    feedTitle: "Chelsea FC True Blue",
    feedDescription:
      "A Chelsea FC Blog written by a true Chelsea fan. Get all the latest news, transfer news, match previews, and match reports of Chelsea Football Club.",
    feedUrl: "https://feeds.feedburner.com/chelseatrueblue",
    feedSiteUrl: "https://www.chelseatrueblue.com/",
    sourceKind: "rss",
    itemTitle: "Player of the Year: Cole Palmer Makes History with FSA Award Win",
    itemSummary:
      "Cole Palmer has reached another remarkable milestone, being named the 2024 Men’s Player of the Year at the The post Player of the Year: Cole Palmer Makes History with FSA Award Win appeared first on Chelsea FC True Blue .",
    itemContentText:
      "Cole Palmer has reached another remarkable milestone, being named the 2024 Men’s Player of the Year at the The post Player of the Year: Cole Palmer Makes History with FSA Award Win appeared first on Chelsea FC True Blue .",
    itemUrl: "https://www.chelseatrueblue.com/player-of-the-year/",
    expected: ["Sports"],
  },
  {
    id: "stored-fff3ad7a",
    source: "stored",
    feedTitle:
      "California History-Social Science Project - Resources & professional learning for K-12 history-social science",
    feedDescription: "Blog Articles",
    feedUrl: "https://chssp.ucdavis.edu/blog.rss",
    feedSiteUrl: "https://chssp.ucdavis.edu/",
    sourceKind: "rss",
    itemTitle: "Teaching the 2024 Election",
    itemSummary:
      "In the coming days, the electoral process is going to play out in ways that may be all-consuming for many Americans. This will deeply affect some students and not others. The 2016 and 2020 elections were surprising and tumultuous in ways",
    itemContentText:
      "In the coming days, the electoral process is going to play out in ways that may be all-consuming for many Americans. This will deeply affect some students and not others. The 2016 and 2020 elections were surprising and tumultuous in ways that left some of us scrambling for how to help our students understand the quickly shifting political landscape and government. While this election will likely bring to light many new questions and uncertainties, we do know that our",
    itemUrl: "https://chssp.ucdavis.edu/blog/teaching-2024-election",
    expected: ["Education & Work", "Politics & Policy"],
  },
];
