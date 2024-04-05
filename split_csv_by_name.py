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
    mapping = {
        0: 'rot',
        0.3333: 'gelb',
        0.6666: 'hellgrün',
        1: 'grün',
        np.nan: 'nicht bewertet',
    }

# Replace values according to the mapping
    df['rating'] = df['rating'].replace(mapping)
    groups = df.groupby(column_id)

    output_folder = f"ratings_for_each_municipality"
    os.makedirs(output_folder, exist_ok=True)

    for group_name, group_df in groups:
        file_name = os.path.join(output_folder, f"{group_name}_ratings.csv")
        group_df.to_csv(file_name, index=False)
        print(f"Saved '{group_name}' to '{file_name}'")

csv_file = inFile
column_id = "localteam_id.municipality_name"
split_csv_by_column(csv_file, column_id)
