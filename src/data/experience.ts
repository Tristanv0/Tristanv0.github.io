export interface TimelineEntry {
  id: string;
  kind: 'work' | 'education' | 'club';
  date: string;
  year: string;
  months: string;
  title: string;
  organization: string;
  shortOrganization: string;
  logo?: string;
  location: string;
  startMonth: string;
  endMonth: string;
  inProgress?: boolean;
  highlights: string[];
}

export const experiences: TimelineEntry[] = [
  {
    id: 'wsib-2026', kind: 'work',
    date: 'Sep 2026 — Dec 2026', year: '2026', months: 'Sep — Dec',
    startMonth: '2026-09', endMonth: '2026-12', inProgress: true,
    title: 'Full Stack Developer Intern',
    organization: 'Workplace Safety & Insurance Board (WSIB) — Innovation Lab',
    shortOrganization: 'WSIB · Innovation Lab',
    logo: '/images/companies/wsib-logo.jpeg', location: 'Waterloo, ON',
    highlights: ['Internship in progress — I’ll fill this in soon!'],
  },
  {
    id: 'wsib', kind: 'work',
    date: 'Jan 2025 — Dec 2025', year: '2025', months: 'Jan — Dec',
    title: 'Full Stack Developer Intern',
    organization: 'Workplace Safety & Insurance Board (WSIB) — Innovation Lab',
    shortOrganization: 'WSIB · Innovation Lab',
    logo: '/images/companies/wsib-logo.jpeg', location: 'Waterloo, ON',
    startMonth: '2025-01', endMonth: '2025-12',
    highlights: [
      'Built a React and Flask dashboard with search and verification, cutting accommodation-entry time by **over 50%**.',
      'Automated record extraction from **320 PDF and DOCX documents** with PyMuPDF, docx2txt and Azure OpenAI. Ranked related accommodation records using embeddings, cosine similarity and weighted Jaccard similarity.',
      'Secured APIs with JWT authentication, role-based access control, Redis rate limiting and email verification. Deployed the application on Azure and authored **172 pytest integration tests** across **10 backend modules**.',
    ],
  },
  {
    id: 'unity-health', kind: 'work',
    date: 'Aug 2024 — Dec 2024', year: '2024', months: 'Aug — Dec',
    title: 'Quality Assurance Lead Intern',
    organization: 'Unity Health Toronto', shortOrganization: 'Unity Health Toronto',
    logo: '/images/companies/unity-health-toronto-logo.jpeg', location: 'Toronto, ON',
    startMonth: '2024-08', endMonth: '2024-12',
    highlights: [
      'Coordinated black-box testing with a **99% success rate** across test cases.',
      'Led **6 student testers**, organizing workloads and test plans to reduce duplicate work and improve testing efficiency.',
    ],
  },
];

export const campusExperiences: TimelineEntry[] = [
  {
    id: 'tmu-blueprint', kind: 'club',
    date: 'Jan 2026 — Apr 2026', year: '2026', months: 'Jan — Apr',
    startMonth: '2026-01', endMonth: '2026-04',
    title: 'Developer',
    organization: 'TMU Blueprint', shortOrganization: 'TMU Blueprint',
    logo: '/images/companies/tmu-bp-logo.png',
    location: 'Toronto, ON',
    highlights: [
      'Contributed to Itty Bitty Critters Wildlife Rehabilitation’s website with TMU Blueprint, on a project featuring a blog and custom content management system.',
      'Translated Figma designs into React interfaces, using custom CSS to implement page layouts, typography, and styling.',
    ],
  },
  {
    id: 'tmu-csa', kind: 'club',
    date: 'Jan 2024 — Dec 2024', year: '2024', months: 'Jan — Dec',
    title: 'Student Software Developer',
    organization: 'TMU Chinese Student Association', shortOrganization: 'TMU Chinese Student Association',
    logo: '/images/companies/tmu-csa-logo.png', location: 'Toronto, ON',
    startMonth: '2024-01', endMonth: '2024-12',
    highlights: [
      'Built a responsive Next.js application with dynamic event galleries and social media integration to showcase club activities and engage members.',
      'Created and assigned development tickets, tracked milestones and coordinated deliverables with the project roadmap and deadlines.',
      'Delivered the student association website, which has reached **250+ unique visitors**.',
    ],
  },
];

export const education: TimelineEntry = {
  id: 'tmu-education', kind: 'education',
  date: 'Sep 2022 — Dec 2027 (expected)', year: '2022–27', months: 'Graduating Dec 2027',
  title: 'Bachelor of Science in Computer Science',
  organization: 'Toronto Metropolitan University', shortOrganization: 'Toronto Metropolitan University',
  location: 'Toronto, ON', startMonth: '2022-09', endMonth: '2027-12', inProgress: true,
  highlights: [
    'Concentration in **Software Engineering**.',
    'Relevant coursework: Data Structures & Algorithms, Databases, Object-Oriented Programming, Discrete Mathematics, Statistics, and Software Engineering.',
  ],
};

const monthIndex = (month: string) => {
  const [year, number] = month.split('-').map(Number);
  return year * 12 + number - 1;
};

function positionsFor(entries: TimelineEntry[]) {
  const ranges = entries.map(entry => ({ entry, start: monthIndex(entry.startMonth), end: monthIndex(entry.endMonth) + 1 }));
  const boundaries = [...new Set(ranges.flatMap(range => [range.start, range.end]))].sort((a, b) => a - b);
  const positions = new Map<number, number>();
  let total = 0;
  boundaries.forEach((boundary, index) => {
    positions.set(boundary, total);
    const next = boundaries[index + 1];
    if (next === undefined) return;
    const occupied = ranges.some(range => range.start <= boundary && range.end >= next);
    // Shared date boundaries stay aligned. Give occupied periods room for
    // their labels, and compress inactive gaps into a small visual pause.
    total += occupied ? Math.max(next - boundary, 10) : Math.min(next - boundary, 1.5);
  });
  return new Map(ranges.map(({ entry, start, end }) => [entry.id, {
    offset: positions.get(start)! / total * 100,
    width: (positions.get(end)! - positions.get(start)!) / total * 100,
  }]));
}

const workPositions = positionsFor(experiences);
const campusPositions = positionsFor(campusExperiences);

export function timelineLayout(entry: TimelineEntry) {
  if (entry.kind === 'education') return { offset: 0, width: 100 };
  return (entry.kind === 'club' ? campusPositions : workPositions).get(entry.id)!;
}
