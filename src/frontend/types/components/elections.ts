import type { AnswerValue, NumericValue, Sector } from "~/shared/domain";
export interface Election {
  id?: string | undefined;
  descriptor?: string | null | undefined;
  is_party_election?: boolean | null | undefined;
  simple_answer_mode?: boolean | null | undefined;
  sharepic?: string | { id: string } | null | undefined;
  sharepic_dark?: string | { id: string } | null | undefined;
  custom_logo?: string | null | undefined;
  response_cutoff_date?: string | null | undefined;
  localteam?:
    | {
        municipality_name?: string | null | undefined;
        municipality_id?: { state?: string | null | undefined } | null | undefined;
      }
    | null
    | undefined;
}
export interface ElectionQuestion {
  id: string;
  title?: string | null | undefined;
  thesis?: string | null | undefined;
  background_information?: string | null | undefined;
  sector?: Sector | null | undefined;
}
export interface CandidateAnswer {
  candidate: string | { id: string };
  question: string | { id: string };
  response?: NumericValue | undefined;
  explanation?: string | null | undefined;
}
export interface ElectionCandidate {
  id: string;
  name?: string | null | undefined;
  party?: string | null | undefined;
  has_answered?: boolean | null | undefined;
  answers?: Omit<CandidateAnswer, "candidate">[] | undefined;
  time_first_submitted?: string | null | undefined;
  time_last_edited?: string | null | undefined;
}
export type UserAnswers = Record<string, AnswerValue | null | undefined>;
export interface WahlcheckResult {
  candidateId: string;
  score: number;
  maxScore: number;
  percentage: number;
}
