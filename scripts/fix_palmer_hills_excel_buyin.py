from __future__ import annotations

from pathlib import Path

from openpyxl import load_workbook


def main() -> None:
    src = Path("docs/palmer_hills_nassau_skins_recreated.xlsx")
    dst = Path("docs/palmer_hills_nassau_skins_corrected_buyin.xlsx")

    wb = load_workbook(src, data_only=False)

    setup = wb["Setup"]
    nassau = wb["Nassau"]

    # Setup!B3 remains the per-player Nassau buy-in (total for the Nassau).
    # The requested meaning is: $15 per player total => $5 per segment per player.
    setup["A3"].value = "Nassau buy-in ($ per player)"

    # Derived values (no need to add new cells):
    # - players = Setup!B5
    # - teams   = Setup!B6
    # - per player per segment = Setup!B3/3
    # - per team per segment   = (Setup!B5/Setup!B6) * (Setup!B3/3)
    per_team_per_segment = "(Setup!B5/Setup!B6)*(Setup!B3/3)"

    # Segment pot should be total segment pot across all teams/players.
    # Equivalent to: players * (buyin/3)
    segment_pot = "Setup!B5*(Setup!B3/3)"

    for row in (4, 5, 6):
        # Pot
        nassau[f"H{row}"].value = f"={segment_pot}"

        # Team net columns: I (Team A), J (Team B), K (Team C)
        # Previous logic was based on per-team per-segment fee; keep structure, but switch fee meaning.
        nassau[f"I{row}"].value = f"=IF(F{row}=3,0,IF(L{row}=1,(H{row}/F{row})-{per_team_per_segment},-{per_team_per_segment}))"
        nassau[f"J{row}"].value = f"=IF(F{row}=3,0,IF(M{row}=1,(H{row}/F{row})-{per_team_per_segment},-{per_team_per_segment}))"
        nassau[f"K{row}"].value = f"=IF(F{row}=3,0,IF(N{row}=1,(H{row}/F{row})-{per_team_per_segment},-{per_team_per_segment}))"

    wb.save(dst)
    print(f"Wrote corrected workbook: {dst}")


if __name__ == "__main__":
    main()
