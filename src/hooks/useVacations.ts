import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NewVacationRecord, VacationRecord } from '../types';
import {
  createVacations,
  deleteVacation,
  listVacations,
} from '../services/vacations';

// IMPORTANT: always scope by userId. Admins' RLS lets them SELECT every row,
// so an unfiltered listVacations() would mix other users' records into the
// admin's own dashboard stats.
function vacationsKey(userId: string) {
  return ['vacations', userId];
}

export function useVacations(userId: string) {
  return useQuery({
    queryKey: vacationsKey(userId),
    queryFn: () => listVacations(userId),
    enabled: !!userId,
  });
}

export function useCreateVacations(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (records: NewVacationRecord[]) => createVacations(records, userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: vacationsKey(userId) }),
  });
}

export function useDeleteVacation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteVacation,
    // optimistic removal; rolled back on error
    onMutate: async (id: string) => {
      const key = vacationsKey(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<VacationRecord[]>(key);
      queryClient.setQueryData<VacationRecord[]>(key, (old) =>
        (old ?? []).filter((record) => record.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(vacationsKey(userId), context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: vacationsKey(userId) }),
  });
}
