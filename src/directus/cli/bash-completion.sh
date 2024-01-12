alias directus-cli="/directus/directus-cli"

_directus-cli_yargs_completions()
{
    # remove colon from COMP_WORDBREAKS so e.g. auth:test is treated as one word
    COMP_WORDBREAKS=${COMP_WORDBREAKS//:}

    local cur_word args type_list

    cur_word="${COMP_WORDS[COMP_CWORD]}"
    args=("${COMP_WORDS[@]}")

    # ask yargs to generate completions.
    type_list=$(directus-cli --get-yargs-completions "${args[@]}")

    COMPREPLY=( $(compgen -W "${type_list}" -- ${cur_word}) )

    # if no match was found, fall back to filename completion
    if [ ${#COMPREPLY[@]} -eq 0 ]; then
      COMPREPLY=()
    fi

    return 0
}

complete -o bashdefault -o default -F _directus-cli_yargs_completions directus-cli
