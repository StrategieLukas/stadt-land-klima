import os
import pandas as pd
import sys
import numpy as np
if len(sys.argv) > 1:
    inFile = sys.argv[1]
else:
    print("Please provide the input csv. In the execution of the script as an argument")
    exit(1)



def split_csv_by_column(csv_file, column_id):
    df = pd.read_csv(csv_file)
    score_mapping = {
        0: 'Rot',
        0.3333: 'Gelb',
        0.6666: 'Hellgrün',
        1: 'Dunkelgrün',
        np.nan: '-',
    }
    sector_mapping = {
        "transport" : "Verkehr",
        "energy" : "Energie",
        "cpma" : "Klimaschutzmanagement",
        "ann" : "Landwirtschaft, Natur & Ernährung",
        "iec" : "Industrie, Wirtschaft & Konsum",
        "bh" : "Gebäude & Wärme"
    }

    # Replace values according to the mappings
    df['rating'] = df['rating'].replace(score_mapping)
    df['measure_id.sector'] = df['measure_id.sector'].replace(sector_mapping)

    # Sort based on sector and then measure name (both alphabetically)
    df = df.sort_values(['measure_id.sector', 'measure_id.name'])

    # Change order of columns and rename to German labels
    cols = ['measure_id.sector', 'measure_id.name', 'rating', 'date_updated', 'source', 'localteam_id.municipality_name']
    df = df[cols]
    df = df.rename(columns={'rating':'Bewertung', 'source':'Quelle', 'date_updated':'Zuletzt verändert', 'measure_id.name':'Name der Maßnahme', 'measure_id.sector':'Sektor', 'localteam_id.municipality_name':'Kommune'})


    groups = df.groupby(column_id)

    output_folder = f"ratings_for_each_municipality"
    os.makedirs(output_folder, exist_ok=True)

    for group_name, group_df in groups:
        file_name = os.path.join(output_folder, f"{group_name}_ratings.csv")
        group_df.to_csv(file_name, index=False)
        print(f"Saved '{group_name}' to '{file_name}'")

csv_file = inFile
column_id = "Kommune"
split_csv_by_column(csv_file, column_id)
