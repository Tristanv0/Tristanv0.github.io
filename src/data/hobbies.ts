export const HOBBIES = [
  { id: 'running', label: 'Running', color: '#FC4C02', trail: '#bc3900', description: 'Latest runs' },
  { id: 'gym', label: 'The gym', color: '#1E6FFF', trail: '#134cc7', description: 'Latest gym workouts' },
  { id: 'badminton', label: 'Badminton', color: '#05A74F', trail: '#037535', description: 'Latest badminton days' },
] as const;
export type HobbyId = typeof HOBBIES[number]['id'];
