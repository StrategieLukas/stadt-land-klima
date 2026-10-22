import type { AnswerValue, NumericValue, Sector } from "~/shared/domain";
export interface Election {
  id?: string;
  descriptor?: string | null;
  is_party_election?: boolean | null;
  simple_answer_mode?: boolean | null;
  sharepic?: string | { id: string } | null;
  sharepic_dark?: string | { id: string } | null;
  custom_logo?: string | null;
  response_cutoff_date?: string | null;
  localteam?: { municipality_name?: string | null; municipality_id?: { state?: string | null } | null } | null;
}
export interface ElectionQuestion {
  id: string;
  title?: string | null;
  thesis?: string | null;
  background_information?: string | null;
  sector?: Sector | null;
}
export interface CandidateAnswer {
  candidate: string | { id: string };
  question: string | { id: string };
  response?: NumericValue;
  explanation?: string | null;
}
export interface ElectionCandidate {
  id: string;
  name?: string | null;
  party?: string | null;
  has_answered?: boolean | null;
  answers?: Omit<CandidateAnswer, "candidate">[];
  time_first_submitted?: string | null;
  time_last_edited?: string | null;
}
export type UserAnswers = Record<string, AnswerValue | null | undefined>;
export interface WahlcheckResult {
  candidateId: string;
  score: number;
  maxScore: number;
  percentage: number;
}
