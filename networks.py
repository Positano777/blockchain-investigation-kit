"""Reviewed EVM mainnet registry shared with the static browser (no endpoints)."""
import json
from pathlib import Path

NETWORKS=json.loads((Path(__file__).resolve().parent/'web/networks.json').read_text(encoding='utf-8'))
BY_CHAIN={row['chainId']:row for row in NETWORKS}
if len(BY_CHAIN)!=len(NETWORKS):raise ValueError('Duplicate registry chain')


def network(chain):
    if type(chain) is not int or chain not in BY_CHAIN:raise ValueError('Unsupported EVM chain')
    return BY_CHAIN[chain]
