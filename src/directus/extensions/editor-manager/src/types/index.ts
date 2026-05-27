// Data model interfaces for the editor-manager operations

export interface LocalTeam {
  id: string;
  municipality_name: string;
}

export interface DirectusUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  localteams: Array<{ localteam_id: string }>;
}

export interface Role {
  id: string;
  name: string;
}

export interface Editor {
  id: string;
  email: string;
}

export interface MailTemplateData {
  url: string;
  email: string;
  fullName: string;
  municipality_name: string;
}
