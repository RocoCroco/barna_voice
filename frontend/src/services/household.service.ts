export interface HouseholdContext {
  id: string;
  displayName: string;
}

export const householdService = {
  async getCurrent(): Promise<HouseholdContext> {
    return {
      id: 'local-tv-household',
      displayName: 'This household',
    };
  },
};
